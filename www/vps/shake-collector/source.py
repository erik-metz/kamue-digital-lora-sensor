"""Raspberry Shake station discovery and CAPS/MiniSEED transport."""

import asyncio
import io
import logging
import struct
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit, urlunsplit

import httpx
import websockets

LOG = logging.getLogger(__name__)


async def discover_station(config):
    """Resolve an active vertical geophone channel and its actual coordinates."""
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            f"{config.SHAKE_FDSN_URL.rstrip('/')}/station/1/query",
            params={
                "network": config.SHAKE_NETWORK,
                "station": config.SHAKE_STATION,
                "level": "channel",
                "format": "text",
                "channel": "EHZ,SHZ",
                "endafter": datetime.now(UTC).isoformat(),
            },
        )
        response.raise_for_status()
    channels = []
    for line in response.text.splitlines():
        if not line or line.startswith("#"):
            continue
        fields = line.split("|")
        if (
            len(fields) >= 6
            and fields[0] == config.SHAKE_NETWORK
            and fields[1] == config.SHAKE_STATION
            and fields[3] in ("EHZ", "SHZ")
        ):
            channels.append(fields)
    if not channels:
        raise ValueError(
            f"No active vertical geophone channel for {config.SHAKE_STATION}"
        )
    fields = min(
        channels,
        key=lambda row: (
            row[3] != config.SHAKE_CHANNEL,
            row[2] != config.SHAKE_LOCATION,
            row[2],
        ),
    )
    config.SHAKE_LOCATION, config.SHAKE_CHANNEL = fields[2], fields[3]
    config.LATITUDE, config.LONGITUDE = float(fields[4]), float(fields[5])
    config.SENSOR_DESCRIPTION = f"Raspberry Shake {config.SHAKE_STATION}, vertical geophone channel {config.channel_identifier}"


async def stream_samples(config, start_timestamp=None):
    from obspy import read

    parts = urlsplit(config.SHAKE_WS_URL)
    clean = urlunsplit(
        (parts.scheme, parts.netloc.rsplit("@", 1)[-1], parts.path, "days=1", "")
    )
    async with websockets.connect(
        clean,
        subprotocols=["caps"],
        ping_interval=20,
        ping_timeout=20,
        max_size=10 * 1024 * 1024,
        max_queue=4,
        open_timeout=30,
    ) as ws:
        await ws.send("hello")
        await asyncio.wait_for(ws.recv(), timeout=30)
        await ws.send(f"auth {parts.username or 'swarm'} {parts.password or ''}")
        start = (
            datetime.fromtimestamp(start_timestamp, UTC)
            if start_timestamp is not None
            else datetime.now(UTC) - timedelta(seconds=10)
        )
        await ws.send(
            f"begin request\ntime {start.strftime('%Y,%m,%d,%H,%M,%S')}:\nstream add {config.channel_identifier}\nend"
        )
        while True:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=15)
            except TimeoutError:
                yield []
                continue
            if not isinstance(msg, bytes):
                continue
            offset = 0
            samples = []
            while offset + 6 <= len(msg):
                _, length = struct.unpack_from("<hi", msg, offset)
                offset += 6
                if length <= 0 or offset + length > len(msg):
                    raise ValueError("Malformed CAPS record length")
                traces = read(io.BytesIO(msg[offset : offset + length]), format="MSEED")
                offset += length
                for trace in traces:
                    if trace.id != config.channel_identifier:
                        continue
                    rate = float(trace.stats.sampling_rate)
                    if rate <= 0:
                        raise ValueError("Invalid sample rate")
                    t0 = trace.stats.starttime.timestamp
                    samples.extend(
                        (t0 + i / rate, float(value))
                        for i, value in enumerate(trace.data)
                    )
            if offset != len(msg):
                raise ValueError("Truncated CAPS frame")
            yield samples
