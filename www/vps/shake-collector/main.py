"""Raspberry Shake Telemetry Collector.

Streams live seismic data from Raspberry Shake CAPS WebSocket, decodes
MiniSEED packets, calculates windowed vibration metrics (PGV & RMS),
and pushes telemetry into the Open Ried Sens TimescaleDB backend.
"""

import asyncio
import io
import json
import logging
import math
import re
import signal
import statistics
import struct
import sys
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit, urlunsplit

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False
    np = None

try:
    import websockets
except ImportError:
    websockets = None  # type: ignore

from config import StationSettings, settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("shake-collector")

# Attempt importing ObsPy for standard MiniSEED decoding
try:
    from obspy import read as obspy_read
    HAS_OBSPY = True
    logger.info("ObsPy successfully imported for MiniSEED decoding.")
except ImportError:
    HAS_OBSPY = False
    logger.warning("ObsPy not available; waveform ingestion requires ObsPy.")


class ShakeCollector:
    def __init__(self, station_settings=None) -> None:
        self.settings = station_settings or station_settings_list(settings)[0]
        self.running = False
        self.clean_ws_url, self.auth_user, self.auth_pass = self._parse_ws_url(self.settings.SHAKE_WS_URL)
        self.sample_buffer: list[tuple[float, float]] = []  # (utc_timestamp_sec, value)
        self.last_flush_time = asyncio.get_event_loop().time()
        self.http_client: httpx.AsyncClient | None = None
        self.db_conn = None

    @staticmethod
    def _parse_ws_url(raw_url: str) -> tuple[str, str, str]:
        """Extracts username/password from WebSocket URL and returns clean URL."""
        parts = urlsplit(raw_url)
        username = parts.username or "swarm"
        password = parts.password or "ujHsN9qbYiTAx69H"
        netloc = parts.hostname or "data.raspberryshake.org"
        if parts.port:
            netloc = f"{netloc}:{parts.port}"
        clean_url = urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
        return clean_url, username, password

    async def initialize(self) -> None:
        """Initializes HTTP or DB clients and registers station metadata."""
        if self.settings.INGEST_MODE == "api":
            if self.http_client is None:
                self.http_client = httpx.AsyncClient(timeout=10.0)
            await self._register_metadata_api()
        elif self.settings.INGEST_MODE == "direct_db":
            await self._register_metadata_db()

    async def _register_metadata_api(self) -> None:
        """Registers sensor stations via backend API."""
        if not self.http_client:
            return

        sensors = [
            {
                "sensor_id": self.settings.SENSOR_ID,
                "friendly_name": self.settings.SENSOR_NAME,
                "latitude": self.settings.LATITUDE,
                "longitude": self.settings.LONGITUDE,
                "is_hidden": False,
                "description": self.settings.SENSOR_DESCRIPTION,
            },
        ]

        admin_key = self.settings.ADMIN_API_KEY or self.settings.API_KEY
        headers = {"Authorization": f"Bearer {admin_key}"} if admin_key else {}

        for sensor in sensors:
            try:
                url = f"{self.settings.API_URL}/admin/sensors"
                res = await self.http_client.post(url, json=sensor, headers=headers)
                if res.status_code in (200, 201):
                    logger.info("Registered sensor metadata for '%s'", sensor["sensor_id"])
                elif res.status_code == 409:
                    logger.info("Sensor '%s' already registered in metadata.", sensor["sensor_id"])
                else:
                    logger.warning(
                        "Registration response for '%s': %s %s",
                        sensor["sensor_id"],
                        res.status_code,
                        res.text,
                    )
                    raise RuntimeError(f"Metadata registration failed: {res.status_code}")
            except Exception as e:
                logger.warning("Failed to register metadata for '%s' via API: %s", sensor["sensor_id"], e)
                raise

    async def _register_metadata_db(self) -> None:
        """Registers sensor stations directly in TimescaleDB."""
        try:
            import psycopg

            conninfo = (
                f"postgresql://{self.settings.DB_USER}:{self.settings.DB_PASSWORD}@"
                f"{self.settings.DB_HOST}:{self.settings.DB_PORT}/{self.settings.DB_NAME}"
            )
            async with await psycopg.AsyncConnection.connect(conninfo) as conn:
                async with conn.cursor() as cur:
                    query = """
                        INSERT INTO sensor_metadata (id, friendly_name, latitude, longitude, is_hidden, description)
                        VALUES (%s, %s, %s, %s, FALSE, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            friendly_name = EXCLUDED.friendly_name,
                            latitude = EXCLUDED.latitude,
                            longitude = EXCLUDED.longitude,
                            description = EXCLUDED.description,
                            updated_at = NOW();
                    """
                    await cur.execute(
                        query,
                        (
                            self.settings.SENSOR_ID,
                            self.settings.SENSOR_NAME,
                            self.settings.LATITUDE,
                            self.settings.LONGITUDE,
                            self.settings.SENSOR_DESCRIPTION,
                        ),
                    )
                await conn.commit()
            logger.info("Registered station metadata directly in TimescaleDB.")
        except Exception as e:
            logger.error("Failed to register metadata directly in TimescaleDB: %s", e)
            raise

    async def push_telemetry(self, readings: list[dict]) -> None:
        """Pushes batched readings to the backend API or direct TimescaleDB."""
        if not readings:
            return

        if self.settings.INGEST_MODE == "api":
            if not self.http_client:
                return
            headers = {}
            if self.settings.API_KEY:
                headers["Authorization"] = f"Bearer {self.settings.API_KEY}"
            try:
                res = await self.http_client.post(
                    f"{self.settings.API_URL}/telemetry/batch",
                    json={"readings": readings},
                    headers=headers,
                )
                if res.status_code in (200, 201):
                    logger.debug("Successfully pushed %d readings via API.", len(readings))
                else:
                    logger.error("API push error %s: %s", res.status_code, res.text)
            except Exception as e: # noqa: BLE001
                logger.error("HTTP error pushing telemetry batch: %s", e)

        elif self.settings.INGEST_MODE == "direct_db":
            try:
                import psycopg

                conninfo = (
                    f"postgresql://{self.settings.DB_USER}:{self.settings.DB_PASSWORD}@"
                    f"{self.settings.DB_HOST}:{self.settings.DB_PORT}/{self.settings.DB_NAME}"
                )
                async with await psycopg.AsyncConnection.connect(conninfo) as conn:
                    async with conn.cursor() as cur:
                        records = [
                            (
                                datetime.fromisoformat(r["timestamp"]),
                                r["sensor_id"],
                                r["value"],
                                r["unit"],
                                r["metric"],
                            )
                            for r in readings
                        ]
                        await cur.executemany(
                            """
                            INSERT INTO sensor_data (timestamp, sensor_id, value, unit, metric)
                            VALUES (%s, %s, %s, %s, %s);
                            """,
                            records,
                        )
                    await conn.commit()
                logger.debug("Direct DB inserted %d readings.", len(readings))
            except Exception as e: # noqa: BLE001
                logger.error("Database insertion error: %s", e)

    def process_mseed_payload(self, payload: bytes) -> None:
        """Decodes a MiniSEED record and adds its samples to the buffer."""
        if HAS_OBSPY:
            try:
                st = obspy_read(io.BytesIO(payload), format="MSEED")
                for tr in st:
                    if tr.id != self.settings.channel_identifier:
                        logger.warning("Ignoring unexpected channel %s for %s", tr.id, self.settings.SHAKE_STATION)
                        continue
                    sr = float(tr.stats.sampling_rate)
                    dt = 1.0 / sr if sr > 0 else 0.01
                    t0 = tr.stats.starttime.timestamp
                    samples = tr.data
                    for idx, val in enumerate(samples):
                        self.sample_buffer.append((t0 + (idx * dt), float(val)))
            except Exception as e: # noqa: BLE001
                logger.warning("Error parsing MiniSEED with ObsPy: %s", e)
        else:
            raise RuntimeError("ObsPy is required to decode real waveform samples")

    async def flush_window_if_due(self) -> None:
        """Flushes buffered samples if sampling interval has elapsed."""
        now_loop = asyncio.get_event_loop().time()
        elapsed = now_loop - self.last_flush_time
        if elapsed < self.settings.SAMPLING_INTERVAL_SEC or not self.sample_buffer:
            return

        # Snapshot and clear buffer
        samples = self.sample_buffer
        self.sample_buffer = []
        self.last_flush_time = now_loop

        if not samples:
            return

        if HAS_NUMPY:
            values = np.array([s[1] for s in samples], dtype=np.float64)
            median_val = float(np.median(values))
            detrended = values - median_val
            pgv = float(np.max(np.abs(detrended)))
            rms = float(np.sqrt(np.mean(detrended**2)))
        else:
            raw_vals = [s[1] for s in samples]
            median_val = float(statistics.median(raw_vals))
            detrended = [v - median_val for v in raw_vals]
            pgv = float(max(abs(d) for d in detrended))
            rms = float(math.sqrt(sum(d * d for d in detrended) / len(detrended)))

        ts_utc = datetime.now(UTC)
        ts_iso = ts_utc.isoformat()

        readings = [
            {
                "sensor_id": self.settings.SENSOR_ID,
                "metric": "pgv",
                "value": round(pgv, 2),
                "unit": "counts",
                "timestamp": ts_iso,
            },
            {
                "sensor_id": self.settings.SENSOR_ID,
                "metric": "rms",
                "value": round(rms, 2),
                "unit": "counts",
                "timestamp": ts_iso,
            },
        ]

        if self.settings.STORE_RAW_WAVEFORM:
            step = max(1, self.settings.RAW_DECIMATION_FACTOR)
            for idx in range(0, len(samples), step):
                t_sec, val = samples[idx]
                sample_iso = datetime.fromtimestamp(t_sec, tz=UTC).isoformat()
                readings.append(
                    {
                        "sensor_id": self.settings.SENSOR_ID,
                        "metric": "waveform",
                        "value": round(val, 2),
                        "unit": "counts",
                        "timestamp": sample_iso,
                    }
                )

        logger.info(
            "Flushing %s window: %d raw samples -> PGV=%.1f counts, RMS=%.1f counts",
            self.settings.SHAKE_STATION,
            len(samples),
            pgv,
            rms,
        )
        await self.push_telemetry(readings)

    async def connect_and_stream(self) -> None:
        """Connects to Raspberry Shake CAPS WebSocket and streams data."""
        clean_url = f"{self.clean_ws_url}?days=1"
        logger.info("Connecting to CAPS WebSocket at %s (protocol: caps)...", clean_url)

        headers = {}
        async with websockets.connect(
            clean_url,
            subprotocols=["caps"],
            additional_headers=headers,
            ping_interval=20,
            ping_timeout=20,
            max_size=10 * 1024 * 1024,
        ) as ws:
            logger.info("WebSocket connected. Sending 'hello'...")
            await ws.send("hello")

            welcome_msg = await ws.recv()
            logger.info("Received CAPS welcome: %s", str(welcome_msg).strip())

            # Send authentication
            auth_cmd = f"auth {self.auth_user} {self.auth_pass}"
            await ws.send(auth_cmd)

            # Format start time in UTC: YYYY,MM,DD,HH,MM,SS (required by CAPS)
            t_start = datetime.now(UTC) - timedelta(seconds=10)
            time_str = (
                f"{t_start.year},{t_start.month:02d},{t_start.day:02d},"
                f"{t_start.hour:02d},{t_start.minute:02d},{t_start.second:02d}"
            )

            req_cmd = (
                f"begin request\n"
                f"time {time_str}:\n"
                f"stream add {self.settings.channel_identifier}\n"
                f"end"
            )
            logger.info("Requesting live channel: %s (from %s)", self.settings.channel_identifier, time_str)
            await ws.send(req_cmd)

            # Receive stream loop
            while self.running:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=15.0)
                except TimeoutError:
                    # Ping / keep-alive check
                    await self.flush_window_if_due()
                    continue

                if isinstance(msg, str):
                    try:
                        data_json = json.loads(msg)
                        logger.info("CAPS Control Frame: %s", data_json)
                    except json.JSONDecodeError:
                        logger.debug("CAPS Text Frame: %s", msg)
                elif isinstance(msg, bytes):
                    # Binary frame containing 1 or more records: [int16 req_id, int32 dlen, payload...]
                    offset = 0
                    msg_len = len(msg)
                    while offset + 6 <= msg_len:
                        _, dlen = struct.unpack_from("<hi", msg, offset)
                        offset += 6
                        if dlen <= 0 or offset + dlen > msg_len:
                            break
                        payload = msg[offset : offset + dlen]
                        offset += dlen
                        self.process_mseed_payload(payload)

                    await self.flush_window_if_due()

    async def run(self) -> None:
        """Main execution loop with auto-reconnection and exponential backoff."""
        self.running = True
        backoff = self.settings.RECONNECT_DELAY_SEC
        while self.running:
            try:
                await self.initialize()
                await self.connect_and_stream()
                backoff = self.settings.RECONNECT_DELAY_SEC
            except asyncio.CancelledError:
                break
            except Exception as e: # noqa: BLE001
                logger.error("Station %s connection error: %s. Reconnecting in %.1fs...", self.settings.SHAKE_STATION, e, backoff)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 1.5, self.settings.MAX_RECONNECT_DELAY_SEC)

        if self.http_client:
            await self.http_client.aclose()
        logger.info("Shake Collector shutdown complete.")


def station_settings_list(base):
    """Create isolated runtime metadata for every configured station."""
    codes = list(dict.fromkeys(code.strip().upper() for code in base.SHAKE_STATIONS.split(",") if code.strip()))
    if not codes:
        raise ValueError("SHAKE_STATIONS must contain at least one station")
    for code in codes:
        if not re.fullmatch(r"[A-Z0-9]{5}", code):
            raise ValueError(f"Invalid Raspberry Shake station: {code}")
    return [StationSettings(base, code) for code in codes]


async def discover_station(config):
    """Resolve an active vertical geophone channel and its actual coordinates."""
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            f"{config.SHAKE_FDSN_URL.rstrip('/')}/station/1/query",
            params={"network": config.SHAKE_NETWORK, "station": config.SHAKE_STATION,
                    "level": "channel", "format": "text", "channel": "EHZ,SHZ",
                    "endafter": datetime.now(UTC).isoformat()},
        )
        response.raise_for_status()
    channels = []
    for line in response.text.splitlines():
        if not line or line.startswith("#"):
            continue
        fields = line.split("|")
        if len(fields) >= 6 and fields[0] == config.SHAKE_NETWORK and fields[1] == config.SHAKE_STATION and fields[3] in ("EHZ", "SHZ"):
            channels.append(fields)
    if not channels:
        raise ValueError(f"No active vertical geophone channel for {config.SHAKE_STATION}")
    fields = min(channels, key=lambda row: (row[3] != config.SHAKE_CHANNEL, row[2] != config.SHAKE_LOCATION, row[2]))
    config.SHAKE_LOCATION, config.SHAKE_CHANNEL = fields[2], fields[3]
    config.LATITUDE, config.LONGITUDE = float(fields[4]), float(fields[5])
    config.SENSOR_DESCRIPTION = f"Raspberry Shake {config.SHAKE_STATION}, vertical geophone channel {config.channel_identifier}"


async def run_station(config, startup_delay=0):
    await asyncio.sleep(startup_delay)
    # Metadata failures affect only this station; do not invent coordinates.
    while config.LATITUDE is None or config.LONGITUDE is None:
        try:
            await discover_station(config)
        except (httpx.HTTPError, ValueError) as error:
            logger.warning("Metadata unavailable for %s: %s; retrying in 60s", config.SHAKE_STATION, error)
            await asyncio.sleep(60)
    collector = ShakeCollector(config)
    try:
        await collector.run()
    finally:
        if collector.http_client:
            await collector.http_client.aclose()


async def main() -> None:
    configs = station_settings_list(settings)
    logger.info("Starting %d station collectors: %s", len(configs), ", ".join(c.SHAKE_STATION for c in configs))
    tasks = [asyncio.create_task(run_station(config, index * 0.4), name=config.SHAKE_STATION) for index, config in enumerate(configs)]
    loop = asyncio.get_running_loop()

    def stop_signal():
        for task in tasks:
            task.cancel()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop_signal)
        except NotImplementedError:
            pass
    try:
        await asyncio.gather(*tasks)
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


if __name__ == "__main__":
    asyncio.run(main())
