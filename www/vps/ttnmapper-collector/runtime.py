"""Local polling lifecycle for TTN Mapper & Packet Broker collector."""

import argparse
import asyncio
import json
import logging
import random
import signal
from pathlib import Path

import httpx
from health import check_health, read_status, record_status

LOG = logging.getLogger(__name__)


def retry_delay(interval, failures):
    delay = max(interval, min(3600, interval * 2 ** min(failures, 10)))
    return delay + random.uniform(0, min(10, delay * 0.1))


async def run(settings, cycle, service, *, once=False, dry_run=False, input_file=None):
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)
    path = Path(settings.state_dir) / "status.json"
    status = read_status(path)
    try:
        async with httpx.AsyncClient(
            timeout=45, headers={"User-Agent": f"OpenRiedSens-{service}/1.0"}
        ) as client:
            while not stop.is_set():
                delay = settings.poll_seconds
                try:
                    raw = (
                        json.loads(Path(input_file).read_text()) if input_file else None
                    )
                    async with asyncio.timeout(90):
                        details = await cycle(
                            client, settings, raw=raw, dry_run=dry_run
                        )
                    if dry_run:
                        print(
                            json.dumps(
                                details, default=str, ensure_ascii=False, indent=2
                            )
                        )
                        return
                    status = record_status(path, status, details=details)
                    LOG.info(
                        "Cycle committed: gateways=%s active=%s area_metrics=%s",
                        details.get("gateways_count"),
                        details.get("active_gateways"),
                        details.get("area_metrics"),
                    )
                except Exception as error:
                    if once or dry_run:
                        raise
                    status = record_status(path, status, error=error)
                    delay = retry_delay(
                        settings.poll_seconds, status["consecutive_failures"]
                    )
                    LOG.exception("Cycle failed; retry in %.0fs", delay)
                if once:
                    return
                try:
                    await asyncio.wait_for(stop.wait(), timeout=delay)
                except TimeoutError:
                    pass
    finally:
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.remove_signal_handler(sig)


def cli(settings_factory, run_fn):
    parser = argparse.ArgumentParser(
        description="Collect, normalize and persist LoRaWAN gateway coverage from Packet Broker & TTN Mapper"
    )
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--from-file", dest="input_file")
    parser.add_argument("--healthcheck", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s"
    )
    settings = settings_factory()
    if args.healthcheck:
        raise SystemExit(check_health(Path(settings.state_dir) / "status.json", settings.poll_seconds))
    asyncio.run(run_fn(settings, once=args.once, dry_run=args.dry_run, input_file=args.input_file))
