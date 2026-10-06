# Satellite tracking

Space-Track GP OMM JSON is ingested into `entities`, `measurement_definitions`,
`readings`; existing `latest_readings` and `reading_revisions` maintain current
values and source corrections. Orbital values use `basis=reported`; all positions
use `basis=model`. The original OMM JSON, epoch and SHA-256 version are retained
in orbital reading provenance. `observed_at` for elements means publication time
(`CREATION_DATE`, epoch fallback), not reception time. Position timestamps denote
model evaluation time. Same-publication corrections retain the previous record
in `reading_revisions`; different publications of the same epoch remain separate.

## Enable on the VPS

1. Install the existing canonical measurement migration before starting the
   collector (see `../measurement-migration-runbook.md`). No new main table is needed.
2. Configure `SPACE_TRACK_IDENTITY`, `SPACE_TRACK_PASSWORD` and a comma-separated
   `SATELLITE_NORAD_IDS` selection in the server environment. The default is ISS
   (`25544`); at most 500 identifiers are accepted. Never put credentials in Git
   or in the browser. Direct execution also accepts `SPACE_TRACK_IDENTITY_FILE`
   and `SPACE_TRACK_PASSWORD_FILE` pointing to mounted secret files.
3. `docker compose --profile satellites up -d satellite-collector backend-api`
4. Open `/satellites` in the frontend, also linked from the map legend.

The opt-in profile leaves installations without credentials operational.
Missing credentials cause a clear startup error. Only this collector contacts
Space-Track. A session advisory lock prevents duplicate collectors. Persistent
cooldown is kept in the feed entity; even failed attempts/restarts wait at least
one hour, with jitter. GP_HISTORY is never used for live polling. See the source
retrieval rules: https://www.space-track.org/documentation . Verify account terms
and applicable redistribution permissions before exposing the feed publicly.

## History import

Download the selected GP_HISTORY data once using your account, as OMM JSON.
For large ranges use Space-Track's documented bulk archives. Mount the downloaded
file read-only and execute the collector with `--history-file /path/history.json`
(or locally set DB variables and run `python collector.py --history-file ...`).
Only configured NORAD IDs are imported; repeated imports are idempotent. Stop
the live collector during the import because both intentionally share a lock.
This restores orbital history; it does not invent previously recorded positions.
The orbit API can reconstruct a historical track from elements published by the
requested time. Ten-second recorded position histories begin with live collection.

## API and cadence

- `/api/v1/satellites/latest`: centrally cached one-second model snapshot.
- `/api/v1/satellites/stream`: SSE every second, cleanup on disconnect.
- `/api/v1/satellites/{norad}/history?start=...&end=...&limit=...`:
  recorded positions, maximum seven days, up to 10,000 points per page.
  Continue with `next_start` as the next inclusive start; end is exclusive.
- `/api/v1/satellites/{norad}/orbit?at=...&minutes=90`:
  thirty-second samples from one element set, maximum 180 minutes.
  UTC/timezone-qualified timestamps required; absent or stale elements return 404.

Original elements are polled hourly; positions are persisted every ten seconds.
The API shares live propagation across viewers within each server process.
No client makes per-satellite upstream queries. Elements older than ten days are
excluded, and the UI displays element age. WGS72 SGP4 dynamics and WGS84 geodetic
coordinates are used; TEME rotation uses GMST without polar motion, suitable for
visualization rather than precision navigation. Speed is TEME inertial speed.

Four position readings every ten seconds produce 34,560 rows per satellite/day.
Choose IDs deliberately and apply the existing archive/retention workflow after
measuring capacity. Do not activate a full catalog at this cadence by default.

Tests: `PYTHONPATH=www/vps/satellite-collector:www/vps/api/v1 .venv/bin/python -m pytest www/vps/satellite-collector/tests`.
Database tests require `SATELLITE_TEST_DATABASE_URL` and create an isolated schema.
