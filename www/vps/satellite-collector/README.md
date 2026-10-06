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
   `SATELLITE_NORAD_IDS` selection in the server environment. The default is `all`: every publicly available PAYLOAD satellite with fresh GP
   elements. New satellites are discovered on every hourly bulk GP refresh.
   An explicit comma-separated selection (maximum 500 IDs) remains supported. Never put credentials in Git
   or in the browser. Direct execution also accepts `SPACE_TRACK_IDENTITY_FILE`
   and `SPACE_TRACK_PASSWORD_FILE` pointing to mounted secret files.
3. `docker compose --profile satellites up -d satellite-collector backend-api`
4. Enable the **Satelliten** layer in the existing Ried map's layer controls
   (Mobilität & Verkehr). Markers show actual model ground positions, with details
   on click. The stream closes when the layer is disabled. Ground positions outside
   the regional map bounds are not relocated; the legend reports an empty viewport.
   History is persisted in the database, with no separate page or playback in the UI.

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
requested time. Ten-second recorded position histories begin with live collection
and are recorded only inside the Ried bounds.

## API and cadence

- `/api/v1/satellites/latest`: centrally cached one-second regional model snapshot.
  Contains `status`, `catalog_count`, `valid_orbit_count`, import time and region
  bounds; an empty region with valid orbits is `ready`, not a source failure.
- `/api/v1/satellites/stream`: SSE every second, cleanup on disconnect.
- `/api/v1/satellites/{norad}/history?start=...&end=...&limit=...`:
  recorded positions, maximum seven days, up to 10,000 points per page.
  Continue with `next_start` as the next inclusive start; end is exclusive.
- `/api/v1/satellites/{norad}/orbit?at=...&minutes=90`:
  thirty-second samples from one element set, maximum 180 minutes.
  UTC/timezone-qualified timestamps required; absent or stale elements return 404.

Original elements are polled hourly as one bulk GP query (`OBJECT_TYPE/PAYLOAD`,
`DECAY_DATE/null-val`, `EPOCH/>now-10`). This discovers new satellites without a
separate request per object. SATCAT PAYLOAD records are reconciled daily after
17:05 UTC (or on startup after that time), with persistent independent cooldowns.
Explicit decay records disable current propagation; missing records never delete
history. Changed catalog records are stored as `catalog_status` readings with raw
catalog provenance. No SATCAT fetch is made before 17:05 UTC.

Positions are persisted every ten seconds only within the inclusive bounds
49.45–49.90° N, 8.15–8.80° E, matching the existing map's regional bounding box
(not municipal polygon boundaries). `regional_presence` readings record sampled
entry/exit transitions (ten-second resolution); no outside coordinates are stored.
Previous presence survives restarts. Historical orbital records are never deleted.

Compiled SGP4 orbits are retained in memory. A cheap geocentric latitude and
longitude gate rejects outside candidates before WGS84 projection; the final
WGS84 coordinate must pass the exact region test. The API reloads orbits every
60 seconds and runs propagation off the event loop, sharing one regional snapshot
per process across clients. This bounds stream/DB payloads to regional satellites.
The API shares live propagation across viewers within each server process.
No client makes per-satellite upstream queries. Elements older than ten days are
excluded, and the UI displays element age. WGS72 SGP4 dynamics and WGS84 geodetic
coordinates are used; TEME rotation uses GMST without polar motion, suitable for
visualization rather than precision navigation. Speed is TEME inertial speed.

Only regional samples produce the four position readings; outside passes produce
none. Apply the existing archive/retention workflow to historical regional readings.
The historical orbit API remains explicit and may reconstruct global tracks; it is
not part of the live regional stream or frontend playback.

Tests: `PYTHONPATH=www/vps/satellite-collector:www/vps/api/v1 .venv/bin/python -m pytest www/vps/satellite-collector/tests`.
Database tests require `SATELLITE_TEST_DATABASE_URL` and create an isolated schema.
