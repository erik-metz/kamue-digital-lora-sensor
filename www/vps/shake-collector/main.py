"""Independent station readers and durable, acknowledged writers."""

import argparse
import asyncio
import json
import logging
import random
import signal
from datetime import UTC, datetime
from pathlib import Path

from buffer import Spool
from config import Settings, station_settings_list
from health import check_health, read_status, record_status
from normalize import Windows
from source import discover_station, stream_samples
from storage import Writer

LOG = logging.getLogger(__name__)


async def run_station(config, stop):
    directory = Path(config.state_dir) / config.SENSOR_ID
    spool = Spool(directory / "spool.json", config.queue_batches)
    windows = Windows(config, spool.state["watermark"])
    changed = asyncio.Event()
    path = directory / "status.json"
    status = read_status(path)
    writer = Writer(config)
    last_cutoff = None

    async def enqueue(cutoff):
        for batch in windows.ready(cutoff):
            while len(spool.state["pending"]) >= spool.capacity:
                changed.clear()
                await changed.wait()
            spool.append(batch)
            windows.acknowledge(batch)
            changed.set()

    async def read():
        nonlocal last_cutoff
        failures = 0
        latest_sample = spool.state["watermark"]
        while True:
            try:
                await discover_station(config)
                async for samples in stream_samples(config, spool.state["watermark"]):
                    now = datetime.now(UTC).timestamp()
                    if any(timestamp > now + 60 for timestamp, _ in samples):
                        raise ValueError("Waveform timestamp is in the future")
                    windows.add(samples)
                    if samples:
                        latest_sample = max(
                            latest_sample or float("-inf"), max(t for t, _ in samples)
                        )
                        # Backfills must finish a window before its first partial record is emitted.
                        cutoff = min(now, latest_sample) - config.lateness_seconds
                    else:
                        cutoff = now - config.lateness_seconds
                    last_cutoff = cutoff
                    await enqueue(cutoff)
                    if samples:
                        failures = 0
            except asyncio.CancelledError:
                raise
            except Exception:
                failures += 1
                LOG.exception("Station %s acquisition failed", config.SHAKE_STATION)
                await asyncio.sleep(
                    min(
                        config.MAX_RECONNECT_DELAY_SEC,
                        config.RECONNECT_DELAY_SEC * 2 ** min(failures, 10),
                    )
                    + random.uniform(0, 1)
                )

    async def write():
        nonlocal status
        while True:
            if not spool.state["pending"]:
                changed.clear()
                await changed.wait()
                continue
            batch = spool.state["pending"][0]
            try:
                stats = await writer.persist(batch)
                spool.acknowledge()
                status = record_status(
                    path,
                    status,
                    details={
                        "ingestion": stats,
                        "latest_observed_at": datetime.fromtimestamp(
                            batch["window_end"], UTC
                        ).isoformat(),
                        "sample_count": batch["sample_count"],
                        "pending_batches": len(spool.state["pending"]),
                        "source_coverage": [config.SHAKE_STATION],
                        "skipped_late_samples": windows.skipped,
                    },
                )
                changed.set()
            except asyncio.CancelledError:
                raise
            except Exception as error:
                status = record_status(path, status, error=error)
                LOG.exception(
                    "Station %s write failed; durable batch retained",
                    config.SHAKE_STATION,
                )
                await asyncio.sleep(
                    min(
                        config.MAX_RECONNECT_DELAY_SEC,
                        config.RECONNECT_DELAY_SEC
                        * 2 ** min(status["consecutive_failures"], 10),
                    )
                    + random.uniform(0, 1)
                )

    reader = asyncio.create_task(read())
    consumer = asyncio.create_task(write())
    try:
        await stop.wait()
    finally:
        reader.cancel()
        await asyncio.gather(reader, return_exceptions=True)
        try:
            async with asyncio.timeout(config.shutdown_seconds):
                if last_cutoff is not None:
                    await enqueue(last_cutoff)
                while spool.state["pending"]:
                    changed.clear()
                    await changed.wait()
        except TimeoutError:
            LOG.warning(
                "%s shutdown: %d durable batches retained; %d samples require source replay",
                config.SHAKE_STATION,
                len(spool.state["pending"]),
                len(windows.samples),
            )
        finally:
            consumer.cancel()
            await asyncio.gather(consumer, return_exceptions=True)
            await writer.close()


async def run(settings, duration=None):
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)
    timer = loop.call_later(duration, stop.set) if duration else None
    tasks = [
        asyncio.create_task(run_station(config, stop))
        for config in station_settings_list(settings)
    ]
    try:
        await asyncio.gather(*tasks)
    finally:
        stop.set()
        await asyncio.gather(*tasks, return_exceptions=True)
        if timer:
            timer.cancel()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.remove_signal_handler(sig)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--healthcheck", action="store_true")
    parser.add_argument(
        "--duration", type=float, help="Capture for a bounded number of seconds"
    )
    parser.add_argument(
        "--input", help="Replay JSON array of [unix_seconds, counts] pairs"
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    settings = Settings.from_env()
    configs = station_settings_list(settings)
    if args.healthcheck:
        raise SystemExit(
            max(
                check_health(
                    Path(settings.state_dir) / c.SENSOR_ID / "status.json",
                    settings.SAMPLING_INTERVAL_SEC,
                    source_max_age=300,
                )
                for c in configs
            )
        )
    if args.input or args.dry_run:
        if not args.input or not args.dry_run or len(configs) != 1:
            parser.error(
                "Offline replay requires --input, --dry-run and one SHAKE_STATIONS entry"
            )
        windows = Windows(configs[0])
        windows.add(json.loads(Path(args.input).read_text()))
        print(json.dumps(list(windows.ready(float("inf"))), indent=2))
        return
    if args.duration is not None and not 0 < args.duration <= 86400:
        parser.error("--duration must be between 0 and 86400 seconds")
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    asyncio.run(run(settings, args.duration))


if __name__ == "__main__":
    main()
