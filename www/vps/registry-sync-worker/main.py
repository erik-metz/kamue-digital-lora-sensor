"""Entry point and daemon runner for registry-sync-worker."""

import argparse
import asyncio
import logging
import sys

try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
except ImportError:
    AsyncIOScheduler = None
    CronTrigger = None

from config import Settings
from scheduler import REGISTERED_JOBS, execute_job, run_all_jobs

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
LOG = logging.getLogger("registry-sync-worker")


def setup_cron_schedule(scheduler: AsyncIOScheduler, settings: Settings):
    tz = settings.timezone

    # 1. Daily Jobs: Infrastructure (04:00) & Social/Events (06:00)
    scheduler.add_job(
        execute_job,
        CronTrigger(hour=4, minute=0, timezone=tz),
        args=["infrastructure", settings],
        id="sync_infrastructure_daily",
        name="Daily Infrastructure Sync",
        replace_existing=True,
    )
    scheduler.add_job(
        execute_job,
        CronTrigger(hour=6, minute=0, timezone=tz),
        args=["social", settings],
        id="sync_social_daily",
        name="Daily Social & Events Sync",
        replace_existing=True,
    )

    # 2. Weekly Jobs: Environment & Agriculture (Mondays 03:00)
    scheduler.add_job(
        execute_job,
        CronTrigger(day_of_week="mon", hour=3, minute=0, timezone=tz),
        args=["environment", settings],
        id="sync_environment_weekly",
        name="Weekly Environment Sync",
        replace_existing=True,
    )

    # 3. Monthly Jobs: Demographics (1st of month 02:00), Real Estate (1st of month 03:00), Economy (15th of month 02:00)
    scheduler.add_job(
        execute_job,
        CronTrigger(day=1, hour=2, minute=0, timezone=tz),
        args=["demographics", settings],
        id="sync_demographics_monthly",
        name="Monthly Demographics Sync",
        replace_existing=True,
    )
    scheduler.add_job(
        execute_job,
        CronTrigger(day=1, hour=3, minute=0, timezone=tz),
        args=["realestate", settings],
        id="sync_realestate_monthly",
        name="Monthly Real Estate & BORIS Sync",
        replace_existing=True,
    )
    scheduler.add_job(
        execute_job,
        CronTrigger(day=15, hour=2, minute=0, timezone=tz),
        args=["economy", settings],
        id="sync_economy_monthly",
        name="Monthly Economy Sync",
        replace_existing=True,
    )

    # 4. Quarterly / Annual: Municipal Finances & Budgets (1st Jan, 1st Apr, 1st Jul, 1st Oct at 04:00)
    scheduler.add_job(
        execute_job,
        CronTrigger(month="1,4,7,10", day=1, hour=4, minute=0, timezone=tz),
        args=["finance", settings],
        id="sync_finance_quarterly",
        name="Quarterly Finance & Budget Sync",
        replace_existing=True,
    )


async def main_async():
    parser = argparse.ArgumentParser(description="Open Ried Sens Registry Sync Worker")
    parser.add_argument("--job", choices=list(REGISTERED_JOBS.keys()), help="Execute a specific sync job immediately")
    parser.add_argument("--all", action="store_true", help="Execute all registered sync jobs immediately")
    parser.add_argument("--dry-run", action="store_true", help="Run in dry-run mode without writing to database")
    args = parser.parse_args()

    settings = Settings.from_env()

    if args.job:
        LOG.info(f"Running single sync job: {args.job} (dry_run={args.dry_run})")
        res = await execute_job(args.job, settings, dry_run=args.dry_run)
        print(f"Result: {res}")
        return

    if args.all:
        LOG.info(f"Running all sync jobs immediately (dry_run={args.dry_run})")
        results = await run_all_jobs(settings, dry_run=args.dry_run)
        print(f"Completed {len(results)} jobs.")
        return

    # Daemon mode: Start scheduler loop
    LOG.info(f"Starting registry-sync-worker daemon with timezone {settings.timezone}...")
    scheduler = AsyncIOScheduler()
    setup_cron_schedule(scheduler, settings)
    scheduler.start()

    # Run an initial lightweight sync check on startup
    try:
        await execute_job("infrastructure", settings, dry_run=args.dry_run)
    except Exception as e:
        LOG.warning(f"Initial startup sync encountered issue: {e}")

    try:
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, SystemExit):
        LOG.info("Stopping registry-sync-worker...")
        scheduler.shutdown()


def main():
    try:
        asyncio.run(main_async())
    except Exception as exc:
        LOG.error(f"Fatal error: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
