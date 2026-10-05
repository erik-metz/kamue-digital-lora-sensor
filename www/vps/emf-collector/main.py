"""Main entrypoint and orchestrator for BNetzA EMF collector."""

import asyncio
import logging
import sys
from datetime import UTC, datetime
from time import monotonic

import httpx
import psycopg

from client import BNetzAEmfClient
from config import Settings
from normalize import normalize_site
from storage import persist_emf_sites

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
LOG = logging.getLogger("emf-collector")


async def poll_cycle(
    client: httpx.AsyncClient,
    settings: Settings,
    *,
    dry_run: bool = False,
    fetch_details: bool = True,
    max_details: int | None = None,
) -> dict:
    """Execute one complete EMF collection cycle for the configured BBox."""
    started = monotonic()
    emf_client = BNetzAEmfClient(settings, client)

    LOG.info(
        "Fetching EMF sites for BBOX [%s,%s] to [%s,%s]...",
        settings.min_lat,
        settings.min_lon,
        settings.max_lat,
        settings.max_lon,
    )
    raw_sites = await emf_client.get_all_sites_tiled(
        settings.min_lat, settings.max_lat, settings.min_lon, settings.max_lon
    )
    LOG.info("Discovered %d raw sites from BNetzA API", len(raw_sites))

    normalized_sites = []
    details_count = 0

    for raw in raw_sites:
        fid = int(raw["fID"])
        details = None
        if fetch_details and (max_details is None or details_count < max_details):
            try:
                # Small pause to avoid aggressive throttling by BNetzA webserver
                await asyncio.sleep(0.1)
                details = await emf_client.get_site_details(fid)
                details_count += 1
            except Exception as e:
                LOG.warning("Failed to fetch detail for FID %d: %s", fid, e)

        normalized = normalize_site(raw, details)
        normalized_sites.append(normalized)

    LOG.info(
        "Normalized %d sites (with %d detailed HTML fetches)",
        len(normalized_sites),
        details_count,
    )

    now = datetime.now(UTC)
    duration_sec = round(monotonic() - started, 2)

    if dry_run:
        return {
            "status": "dry_run",
            "sites_count": len(normalized_sites),
            "details_count": details_count,
            "duration_sec": duration_sec,
            "sample": normalized_sites[0].__dict__ if normalized_sites else None,
        }

    async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
        stats = await persist_emf_sites(conn, normalized_sites, now=now)

    LOG.info("Persist complete in %s seconds: %s", duration_sec, stats)
    return {
        "status": "success",
        "sites_count": len(normalized_sites),
        "details_count": details_count,
        "duration_sec": duration_sec,
        **stats,
    }


async def main():
    settings = Settings.from_env()
    dry_run = "--dry-run" in sys.argv
    once = "--once" in sys.argv or dry_run

    async with httpx.AsyncClient(
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
            "Referer": f"{settings.base_url}/DE/Vportal/TK/Funktechnik/EMF/start.html",
        },
        timeout=25.0,
        follow_redirects=True,
    ) as http_client:
        if once:
            res = await poll_cycle(http_client, settings, dry_run=dry_run)
            LOG.info("Run finished: %s", res)
            return

        while True:
            try:
                await poll_cycle(http_client, settings)
            except Exception as exc:
                LOG.exception("Error in EMF collection cycle: %s", exc)
            LOG.info("Sleeping for %d seconds...", settings.poll_seconds)
            await asyncio.sleep(settings.poll_seconds)


if __name__ == "__main__":
    asyncio.run(main())
