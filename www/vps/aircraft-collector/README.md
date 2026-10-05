# Ried aircraft collector (ADS-B MVP)

`adsb.lol → aircraft-collector → PostgreSQL/TimescaleDB → movements/latest + SSE → Next.js/Leaflet`

The collector queries a 30 nautical mile circle around 49.725/8.475 every 15 seconds
and accepts airborne observations in the buffered Ried rectangle 49.50–49.95 / 8.25–8.70.
This covers local flying and through flights, rather than inferring traffic from airport schedules.
The boundary is a configurable-code MVP region, not a precise administrative Ried polygon.
No origin/destination, airport ownership or complete aircraft coverage is inferred.

The public API needs no key. `AIRCRAFT_POLL_SECONDS` supports 10–300 seconds;
slower polling can produce intervals without visible aircraft because positions always
expire 60 seconds after the actual observation, independent of fetch time.
Dynamic limits are handled using Retry-After, exponential backoff and jitter.
Failed requests are recorded in collection_attempts and never generate synthetic aircraft.
Health checks track successful acquisition, not whether aircraft were present.

Only ICAO-addressed ADS-B/ADS-R/TIS-B/MLAT positions with fresh timestamps and an
indication of airborne altitude are accepted. Ground reports, anonymous non-ICAO
addresses, unknown airborne status, invalid coordinates and stale positions are rejected.
The position timestamp is the snapshot epoch minus seen_pos, normalized to milliseconds.
Duplicate observation timestamps do not create extra history or refresh expiry;
late accepted reports enter history but cannot overwrite a newer live observation.

Normalized accepted observations (not complete provider snapshots) are retained as
hash-addressed evidence in collected_payloads. movement_positions and movement_latest
reuse the existing movement pipeline. Latitude/longitude, ground speed, course,
pressure/geometric altitude and barometric vertical rate also use the canonical
measurement writer for telemetry and existing archive/export operations.
Pressure height uses 1013.25 hPa; geometric height uses WGS84. Neither is height
above ground. Knots/feet/feet per minute are converted to km/h/metres/metres per second.
Missing optional fields remain absent. MLAT is explicitly labelled as multilateration.

The Flugverkehr layer shows direction, source/age and a short trace of received
points (at most 12 points / two minutes). Traces break after reception gaps or large
position jumps. Animation interpolates received coordinates only, stops at its target,
respects reduced motion and does not run for stationary vehicles or hidden tabs.
Positions expire in the browser even during stream failure. The shared stream already
reconnects and supplies full snapshots; polling is retained as fallback.

## Data rights and scope

Source attribution and an ODbL link are visible on the map and retained with each
observation. Keep adsb.lol attribution and ODbL obligations when publishing derived
databases/exports. Aircraft history stays in the existing common archive/retention
pipeline; this change does not silently introduce a seven-day deletion policy.
Monitor storage growth and configure the existing archive deployment accordingly.

This first adapter does **not** consume OGN/FLARM. Small aircraft and gliders are
therefore incomplete. A future OGN adapter must implement current DDB privacy choices,
avoid identity guessing across ICAO/FLARM identifiers and enforce OGN's rule against
redistributing positions older than 24 hours, including archive/export paths. It cannot
simply send OGN records through the unrestricted common history exporter.

References:
- https://api.adsb.lol/docs
- https://github.com/adsblol/api (dynamic rate limits)
- https://github.com/adsblol/website/blob/main/content/en/docs/open-data/api.md (ODbL)
- https://www.glidernet.org/ogn-data-usage/ (future OGN restrictions)

## Deploy

Publish API, collector and frontend from this release. New Compose services are not
created by Watchtower. Back up the database using the existing runbook before applying
schema changes. In the VPS Compose directory, with updated Compose and images:

```sh
docker compose pull backend-api aircraft-collector
docker compose run --rm --no-deps backend-api python migrate.py
docker compose run --rm --no-deps backend-api python measurement_migration.py install
docker compose up -d --no-deps backend-api aircraft-collector
docker compose logs --tail=50 aircraft-collector
```

Both migrations are required: the first enables aircraft history and registers the
source; the second installs the canonical writer with aircraft support. Reinstallation
preserves existing ship/aircraft rows. These steps do not enable shadow writes, backfill
history or switch measurement reader modes. Deploy the frontend too.

Verify Docker health, adsblol-ried in collection status, aircraft_source in movements,
fresh kind=aircraft entries (when received), repeated SSE batches and the Flugverkehr
layer. An empty valid feed is successful acquisition, not evidence of an empty sky.
A bounded acquisition test is available via `python collector.py --seconds 180`.
Disable collection with `docker compose stop aircraft-collector`; live positions expire.
Preserve additive schema/history on rollback.

## Tests

```sh
PYTHONPATH=www/vps/aircraft-collector:www/vps/api/v1:www/vps/tests \
  python -m unittest discover -s www/vps/aircraft-collector/tests
```

COLLECTOR_TEST_DATABASE_URL must point to a disposable database; the harness creates
and removes an isolated schema. Set COLLECTOR_TEST_TIMESCALE=1 for TimescaleDB.
CI checks normalization, deduplication, late reports, repeated installation with
existing aircraft, canonical telemetry, both API reader modes and expiry before
building/publishing the aircraft image along with the other main-branch images.
