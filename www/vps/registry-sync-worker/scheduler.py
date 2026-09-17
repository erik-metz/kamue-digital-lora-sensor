"""Task scheduler and job orchestrator for registry-sync-worker."""

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

try:
    import httpx
except ImportError:
    httpx = None

try:
    import psycopg
except ImportError:
    psycopg = None
from config import Settings
from health import record_job_status
from jobs import (
    demographics_sync,
    economy_sync,
    environment_sync,
    finance_sync,
    infrastructure_sync,
    realestate_sync,
    social_sync,
)
from storage import record_sync_log

LOG = logging.getLogger(__name__)

REGISTERED_JOBS = {
    "infrastructure": infrastructure_sync.run_sync,
    "environment": environment_sync.run_sync,
    "realestate": realestate_sync.run_sync,
    "demographics": demographics_sync.run_sync,
    "economy": economy_sync.run_sync,
    "finance": finance_sync.run_sync,
    "social": social_sync.run_sync,
}


async def execute_job(
    job_key: str,
    settings: Settings,
    *,
    dry_run: bool = False,
) -> dict[str, Any]:
    sync_func = REGISTERED_JOBS.get(job_key)
    if not sync_func:
        raise ValueError(f"Unknown job key: {job_key}. Available: {list(REGISTERED_JOBS.keys())}")

    started_at = datetime.now(UTC)
    LOG.info(f"Executing sync job '{job_key}' (dry_run={dry_run})...")

    health_file = settings.state_dir / "health.json"

    try:
        if dry_run or httpx is None:
            result = await sync_func(None, None, settings, dry_run=True)
        else:
            async with httpx.AsyncClient(timeout=settings.request_timeout) as http_client:
                async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
                    result = await sync_func(conn, http_client, settings, dry_run=False)
                    await record_sync_log(
                        conn,
                        job_name=result.get("job_name", job_key),
                        status="success",
                        started_at=started_at,
                        finished_at=datetime.now(UTC),
                        rows_ingested=result.get("rows_ingested", 0),
                        rows_updated=result.get("rows_updated", 0),
                        source_url=result.get("source_url"),
                        metadata={"dry_run": False},
                    )

        record_job_status(
            health_file,
            job_key,
            success=True,
            rows_ingested=result.get("rows_ingested", 0),
            details={"duration_seconds": result.get("duration_seconds", 0)},
        )
        LOG.info(f"Sync job '{job_key}' finished successfully: {result}")
        return result

    except Exception as exc:
        LOG.exception(f"Sync job '{job_key}' failed: {exc}")
        if not dry_run:
            try:
                async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
                    await record_sync_log(
                        conn,
                        job_name=job_key,
                        status="failed",
                        started_at=started_at,
                        finished_at=datetime.now(UTC),
                        rows_ingested=0,
                        rows_updated=0,
                        error_message=str(exc),
                        metadata={"dry_run": False},
                    )
            except Exception as db_err:
                LOG.error(f"Failed to log sync failure to DB: {db_err}")

        record_job_status(
            health_file,
            job_key,
            success=False,
            rows_ingested=0,
            error=exc,
        )
        raise


async def run_all_jobs(settings: Settings, *, dry_run: bool = False) -> list[dict[str, Any]]:
    results = []
    for job_key in REGISTERED_JOBS:
        try:
            res = await execute_job(job_key, settings, dry_run=dry_run)
            results.append(res)
        except Exception as e:
            results.append({"job_name": job_key, "status": "failed", "error": str(e)})
    return results
