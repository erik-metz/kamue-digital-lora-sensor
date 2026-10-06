# Rhein AIS collector

AISstream WebSocket reception for Frankenthal–Gernsheim, with a small geographic buffer:
49.50–49.79 latitude, 8.30–8.55 longitude. This rectangle is a reception filter,
not a guarantee that all vessels on the river are represented. Inland-AIS/Class A
and Class B positions are accepted; static messages enrich vessel metadata but
never refresh a position's validity. The separate authorized browser adapter is described below.

The server-only `AIS_STREAM_API_KEY` belongs in `www/vps/.env`. No key reaches
FastAPI responses, logs, source receipts, container build contexts or browsers.
The frontend `.env` is not passed to Docker Compose automatically.

## Pipeline

`AISstream → ais-collector → PostgreSQL → /api/v1/movements/{latest,stream} → Next.js → Leaflet`

Validated payloads are hashed and retained in `collected_payloads`. Ship metadata
is stored in `ais_vessels`. `movement_positions` stores reported position history;
`movement_latest` retains the latest timestamp only. The canonical scalar writer
also stores latitude, longitude and speed for existing entity telemetry and archive
exports (`movement:ais:<MMSI>`). All writes for a report share one transaction.
Duplicates do not create additional history; late reports cannot rewind the map.
Provider envelope UTC timestamps are preserved; the AIS seconds field is not
mistaken for a full timestamp. Sentinel values, stale/future reports, invalid
coordinates and reports outside the corridor are rejected.

Positions expire ten minutes after the reported timestamp, including on connection
failure. Frontend animation interpolates received points only, snaps on ship gaps
above 30 seconds or displacement above 150 m, and respects reduced motion. The
Schiffe layer exposes name, MMSI, speed, course, dimensions where supplied, and
source age. A direction arrow uses heading, falling back to course. AIS fields
and names are provider reports, not independently verified identities.

The collector reconnects with exponential backoff and jitter, negotiates compression,
uses keepalive and bounds message size/buffering. A one-minute connection heartbeat
is recorded in `collection_attempts`; `/api/v1/collection/status` and the movement
batch expose reception status. A connected feed without messages does not establish
an empty river. Docker health becomes unhealthy after two minutes without heartbeat.
Existing archive/retention operations apply to movement and canonical histories;
no AIS-specific automatic deletion or retention policy is introduced. Monitor raw
payload/history growth and configure the existing archive process for the deployment.

## Deploy

Publish the API and AIS images from the same release; the workflow builds and pushes
both on main. Watchtower does not create new Compose services or apply migrations.
Back up the database using the existing deployment runbook before schema changes.
From the VPS Compose directory, after updating the Compose file and setting the key:

```sh
docker compose pull backend-api ais-collector
docker compose run --rm --no-deps backend-api python migrate.py
docker compose run --rm --no-deps backend-api python measurement_migration.py install
docker compose up -d --no-deps backend-api ais-collector
docker compose logs --tail=50 ais-collector
```

`migrate.py` allows `ship` in movement history and installs `ais_vessels`.
`measurement_migration.py install` installs the canonical writer with ship support;
it does not enable shadow writes, start historical backfill or switch reader modes.
Recreate the backend before starting acquisition; deploy the Next.js changes too.
An old API image will not contain these migrations. The collector refuses to ingest
when prerequisite tables/functions are missing.

Verify Docker health, `aisstream-rhein` in collection status, fresh `kind: ship`
positions in both the backend and `/api/mobility`, SSE updates, and the Schiffe layer.
The actual number of ships and arrival rate depend on reception. No fake ships are
published if there are no messages. A bounded acquisition run is available via
`python collector.py --seconds 180` with the same environment.

Disable collection with `docker compose stop ais-collector`; positions then expire.
Keep the additive schema and history when rolling back to avoid data loss.

## Validation

```sh
PYTHONPATH=www/vps/ais-collector:www/vps/api/v1:www/vps/tests \
  python -m unittest discover -s www/vps/ais-collector/tests
```

Set `COLLECTOR_TEST_DATABASE_URL` to a disposable PostgreSQL database and
`COLLECTOR_TEST_TIMESCALE=1` for a Timescale instance. Database tests create and
remove an isolated schema, check repeated installation, duplicate/late reports,
canonical/legacy API reads, expiry and paired coordinate history. Never point the
test DSN at production. CI runs these tests against PostgreSQL 16/TimescaleDB.

Source protocol: <https://aisstream.io/documentation/>

## Authorized browser map collector

The project owner confirmed permission for this project's ship map acquisition
on 2026-10-05, with no additional interval/storage/attribution conditions communicated.
`map_collector.py` uses the official map in ordinary headed Chromium under Xvfb.
A fresh viewport is centered on Frankenthal–Gernsheim each cycle. There are no stealth
patches, proxy rotation, imported browser cookies or CAPTCHA workarounds. Any access
error stops the cycle and is recorded; it must be resolved with the provider.

The default/minimum cycle interval is 300 seconds, limited to 240 seconds per cycle.
Map markers discover MMSIs; the normal selected-ship view supplies paired location
and detail responses. Their exact UTC observation times must agree. Marker age codes
and retrieval times are not substituted for observation times. Unsupported protocol
versions, truncated frames, stale reports and sentinel values are rejected. No vessel
movement is extrapolated. Only fresh, observed points enter the existing animation.

Operational identity is `rhein-map`; the frontend labels these as AIS map positions.
This identity is separate from `aisstream-rhein`, with its actual adapter documented
here and in code. Both write to `ais:<MMSI>`; the newest observation wins. Original
paired public responses are archived without browser cookies, account data or headers.
The provider has not supplied an SLA; zero ships does not prove an empty river.

Deploy the shared AIS image, migrate the API schema, then start `rhine-map-collector`.
The new service requires no API key. Its normal user, resource limits and browser
runtime are defined in Compose. Use `xvfb-run -a python map_collector.py --once --probe`
for a bounded read-only test without database access. `--once` alone persists one cycle.
Health reflects successful acquisition within eleven minutes, not complete coverage.
Stop `rhine-map-collector` to disable browser acquisition while keeping AISstream active.
