"""Raspberry Shake Telemetry Collector.

Streams live seismic data from Raspberry Shake CAPS WebSocket, decodes
MiniSEED packets, calculates windowed vibration metrics (PGV & RMS),
and pushes telemetry into the Open Ried Sens TimescaleDB backend.
"""

import asyncio
from datetime import datetime, timezone, timedelta
import io
import json
import logging
import math
import signal
import statistics
import struct
import sys
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

from config import settings

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
    logger.warning("ObsPy not available; using fallback header/sample extractor.")


class ShakeCollector:
    def __init__(self) -> None:
        self.running = False
        self.clean_ws_url, self.auth_user, self.auth_pass = self._parse_ws_url(settings.SHAKE_WS_URL)
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
        if settings.INGEST_MODE == "api":
            self.http_client = httpx.AsyncClient(timeout=10.0)
            await self._register_metadata_api()
        elif settings.INGEST_MODE == "direct_db":
            await self._register_metadata_db()

    async def _register_metadata_api(self) -> None:
        """Registers sensor stations via backend API."""
        if not self.http_client:
            return

        sensors = [
            {
                "sensor_id": settings.SENSOR_ID,
                "friendly_name": settings.SENSOR_NAME,
                "latitude": settings.LATITUDE,
                "longitude": settings.LONGITUDE,
                "is_hidden": False,
                "description": settings.SENSOR_DESCRIPTION,
            },
            {
                "sensor_id": f"{settings.SENSOR_ID}-rms",
                "friendly_name": f"{settings.SENSOR_NAME} (RMS Tremor)",
                "latitude": settings.LATITUDE,
                "longitude": settings.LONGITUDE,
                "is_hidden": False,
                "description": f"RMS vibration noise floor for {settings.SENSOR_ID}",
            },
        ]

        admin_key = settings.ADMIN_API_KEY or settings.API_KEY
        headers = {"Authorization": f"Bearer {admin_key}"} if admin_key else {}

        for sensor in sensors:
            try:
                url = f"{settings.API_URL}/admin/sensors"
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
            except Exception as e: # noqa: BLE001
                logger.warning("Failed to register metadata for '%s' via API: %s", sensor["sensor_id"], e)

    async def _register_metadata_db(self) -> None:
        """Registers sensor stations directly in TimescaleDB."""
        try:
            import psycopg

            conninfo = (
                f"postgresql://{settings.DB_USER}:{settings.DB_PASSWORD}@"
                f"{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
            )
            async with await psycopg.AsyncConnection.connect(conninfo) as conn:
                async with conn.cursor() as cur:
                    query = """
                        INSERT INTO sensor_metadata (sensor_id, friendly_name, latitude, longitude, is_hidden, description)
                        VALUES (%s, %s, %s, %s, FALSE, %s)
                        ON CONFLICT (sensor_id) DO UPDATE SET
                            friendly_name = EXCLUDED.friendly_name,
                            latitude = EXCLUDED.latitude,
                            longitude = EXCLUDED.longitude,
                            description = EXCLUDED.description,
                            updated_at = NOW();
                    """
                    await cur.execute(
                        query,
                        (
                            settings.SENSOR_ID,
                            settings.SENSOR_NAME,
                            settings.LATITUDE,
                            settings.LONGITUDE,
                            settings.SENSOR_DESCRIPTION,
                        ),
                    )
                    await cur.execute(
                        query,
                        (
                            f"{settings.SENSOR_ID}-rms",
                            f"{settings.SENSOR_NAME} (RMS Tremor)",
                            settings.LATITUDE,
                            settings.LONGITUDE,
                            f"RMS vibration noise floor for {settings.SENSOR_ID}",
                        ),
                    )
                await conn.commit()
            logger.info("Registered station metadata directly in TimescaleDB.")
        except Exception as e: # noqa: BLE001
            logger.error("Failed to register metadata directly in TimescaleDB: %s", e)

    async def push_telemetry(self, readings: list[dict]) -> None:
        """Pushes batched readings to the backend API or direct TimescaleDB."""
        if not readings:
            return

        if settings.INGEST_MODE == "api":
            if not self.http_client:
                return
            headers = {}
            if settings.API_KEY:
                headers["Authorization"] = f"Bearer {settings.API_KEY}"
            try:
                res = await self.http_client.post(
                    f"{settings.API_URL}/telemetry/batch",
                    json={"readings": readings},
                    headers=headers,
                )
                if res.status_code in (200, 201):
                    logger.debug("Successfully pushed %d readings via API.", len(readings))
                else:
                    logger.error("API push error %s: %s", res.status_code, res.text)
            except Exception as e: # noqa: BLE001
                logger.error("HTTP error pushing telemetry batch: %s", e)

        elif settings.INGEST_MODE == "direct_db":
            try:
                import psycopg

                conninfo = (
                    f"postgresql://{settings.DB_USER}:{settings.DB_PASSWORD}@"
                    f"{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
                )
                async with await psycopg.AsyncConnection.connect(conninfo) as conn:
                    async with conn.cursor() as cur:
                        records = [
                            (
                                datetime.fromisoformat(r["timestamp"]),
                                r["sensor_id"],
                                r["value"],
                                r["unit"],
                            )
                            for r in readings
                        ]
                        await cur.executemany(
                            """
                            INSERT INTO sensor_data (timestamp, sensor_id, value, unit)
                            VALUES (%s, %s, %s, %s);
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
                    sr = float(tr.stats.sampling_rate)
                    dt = 1.0 / sr if sr > 0 else 0.01
                    t0 = tr.stats.starttime.timestamp
                    samples = tr.data
                    for idx, val in enumerate(samples):
                        self.sample_buffer.append((t0 + (idx * dt), float(val)))
            except Exception as e: # noqa: BLE001
                logger.warning("Error parsing MiniSEED with ObsPy: %s", e)
        else:
            # Fallback: extract sample rate and sample count from fixed section of data header
            try:
                if len(payload) < 48:
                    return
                # BTIME at byte 20..30
                year, doy, hour, minute, sec, sec0001 = struct.unpack(">HHBBBxH", payload[20:30])
                nsamp, sr_fac, sr_mul = struct.unpack(">hhh", payload[30:36])

                sr = float(sr_fac * sr_mul) if sr_fac > 0 and sr_mul > 0 else 100.0
                dt = 1.0 / sr
                base_date = datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(
                    days=doy - 1, hours=hour, minutes=minute, seconds=sec, microseconds=sec0001 * 100
                )
                t0 = base_date.timestamp()

                # Basic mock/placeholder samples if Steim unpacker is not present
                for idx in range(min(nsamp, 50)):
                    self.sample_buffer.append((t0 + (idx * dt), 0.0))
            except Exception as e: # noqa: BLE001
                logger.warning("Error in fallback MiniSEED header parsing: %s", e)

    async def flush_window_if_due(self) -> None:
        """Flushes buffered samples if sampling interval has elapsed."""
        now_loop = asyncio.get_event_loop().time()
        elapsed = now_loop - self.last_flush_time
        if elapsed < settings.SAMPLING_INTERVAL_SEC or not self.sample_buffer:
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

        ts_utc = datetime.now(timezone.utc)
        ts_iso = ts_utc.isoformat()

        readings = [
            {
                "sensor_id": settings.SENSOR_ID,
                "value": round(pgv, 2),
                "unit": "counts",
                "timestamp": ts_iso,
            },
            {
                "sensor_id": f"{settings.SENSOR_ID}-rms",
                "value": round(rms, 2),
                "unit": "counts",
                "timestamp": ts_iso,
            },
        ]

        if settings.STORE_RAW_WAVEFORM:
            step = max(1, settings.RAW_DECIMATION_FACTOR)
            for idx in range(0, len(samples), step):
                t_sec, val = samples[idx]
                sample_iso = datetime.fromtimestamp(t_sec, tz=timezone.utc).isoformat()
                readings.append(
                    {
                        "sensor_id": settings.SENSOR_ID,
                        "value": round(val, 2),
                        "unit": "counts",
                        "timestamp": sample_iso,
                    }
                )

        logger.info(
            "Flushing %s window: %d raw samples -> PGV=%.1f counts, RMS=%.1f counts",
            settings.SHAKE_STATION,
            len(values),
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
            extra_headers=headers,
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
            t_start = datetime.now(timezone.utc) - timedelta(seconds=10)
            time_str = (
                f"{t_start.year},{t_start.month:02d},{t_start.day:02d},"
                f"{t_start.hour:02d},{t_start.minute:02d},{t_start.second:02d}"
            )

            req_cmd = (
                f"begin request\n"
                f"time {time_str}:\n"
                f"stream add {settings.channel_identifier}\n"
                f"end"
            )
            logger.info("Requesting live channel: %s (from %s)", settings.channel_identifier, time_str)
            await ws.send(req_cmd)

            # Receive stream loop
            while self.running:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=15.0)
                except asyncio.TimeoutError:
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
                        if offset + dlen > msg_len:
                            break
                        payload = msg[offset : offset + dlen]
                        offset += dlen
                        self.process_mseed_payload(payload)

                    await self.flush_window_if_due()

    async def run(self) -> None:
        """Main execution loop with auto-reconnection and exponential backoff."""
        self.running = True
        await self.initialize()

        backoff = settings.RECONNECT_DELAY_SEC
        while self.running:
            try:
                await self.connect_and_stream()
                backoff = settings.RECONNECT_DELAY_SEC
            except asyncio.CancelledError:
                break
            except Exception as e: # noqa: BLE001
                logger.error("Connection error: %s. Reconnecting in %.1fs...", e, backoff)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 1.5, settings.MAX_RECONNECT_DELAY_SEC)

        if self.http_client:
            await self.http_client.aclose()
        logger.info("Shake Collector shutdown complete.")


async def main() -> None:
    collector = ShakeCollector()

    loop = asyncio.get_running_loop()

    def stop_signal():
        logger.info("Received termination signal, stopping collector...")
        collector.running = False

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop_signal)
        except NotImplementedError:
            # Windows/non-POSIX signal handling fallback
            pass

    await collector.run()


if __name__ == "__main__":
    asyncio.run(main())
