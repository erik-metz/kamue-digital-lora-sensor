"""Run configured source imports; no generated facts or timestamp-only updates."""
from runner import run_group

async def run_sync(conn=None, client=None, settings=None, *, dry_run=False):
    return await run_group("realestate", settings, dry_run=dry_run)
