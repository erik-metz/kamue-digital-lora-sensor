# Three-table measurement refactor

Status: implementation in progress, updated 2026-09-30. A full VPS backup has been restored locally. Core storage, sensor/movement shadow writes, statistics and charger normalization, compatibility readers and archive core-mode export have been tested locally; no production migration or read cutover has been executed. See `measurement-migration-runbook.md` for current scope and evidence.

## Agreed outcome

All scalar measurements use `entities`, `measurement_definitions`, and `readings`. Latitude and longitude are separate numeric measurements. There is no position column or observation ID. Helper tables describe relationships, source provenance, schedules, geometry, publication status, revisions and caches. Provider requests remain exclusively in VPS acquisition services; API reads never trigger collection. Preserve the existing map icons, popups, layer controls, movement smoothing and API contracts.

## Core contract

### entities

- `id`: stable internal identity; preserve public IDs through explicit aliases.
- `name`, `entity_type`, descriptive metadata and lifecycle timestamps.
- Entities include sensors, physical vehicles, service trips when a vehicle is unknown, municipalities, electoral districts, charging connectors, facilities, road segments and areas.
- Never invent a physical vehicle identity from a timetable or waste calendar. Record source identifiers and entity relationships in helpers. Line 645 is not one bus.
- Metadata holds descriptions, addresses and opening hours. Scalar observations and reported capacities belong in readings, including fixed-location latitude/longitude (write on change, not every poll).

### measurement_definitions

- `id`, `entity_id`, `metric`, canonical `unit`, `source_id`, `basis`, `dimensions`, value semantics and validation rules.
- Identity includes entity, metric, source, basis and canonicalized dimensions. Create a uniqueness constraint on that identity; version definitions when meaning changes.
- Dimensions distinguish depth, age group, sex, party, election, vehicle class, origin/destination, accounting category, budget/actual and other source distinctions. Use stable codes/references, not concatenated display names.
- Value semantics distinguish instantaneous values, counters, period totals, rates, states and interval bounds. Store expected cadence/freshness policy separately from observation time.
- Aggregation period belongs in stream identity when hourly, daily or annual samples otherwise collide. An unchanged metric/unit does not make these streams interchangeable. Use explicit aggregation rules: counters require reset-aware differences, states are not averaged, and population snapshots are not summed across time.
- Latitude and longitude use degrees and WGS84, with separate range validation. Measured and predicted streams are distinct definitions.

### readings

- `measurement_id`, `observed_at`, one numeric `value`, optional `period_start`/`period_end`, `collected_at`, provenance reference and quality.
- Unique current reading per `(measurement_id, observed_at)`. The definition and time conventions must distinguish all legitimate samples; do not silently discard timestamp collisions.
- Periodic statistics use their published reference date or a documented reporting-period anchor, never download time. Preserve original period labels. Forecast issue/model run belongs in provenance/revisions; valid time belongs in `observed_at`.
- Start with PostgreSQL `NUMERIC` as the candidate single value type for decimal financial precision. Benchmark real seismic and movement volumes before finalizing precision/storage. Never pass exact amounts through floating-point conversion before insertion.
- Unknown/suppressed observations have a null value and explicit quality reason when the source reports them; collection failures are tracked in collection status, not fabricated zero readings.
- Retry of unchanged source data is idempotent. Corrections preserve previous values and provenance in a revision helper. Re-fetching does not change the observation timestamp or make stale data fresh.
- Store in a time-partitioned Timescale hypertable; validate constraints and migration syntax against the deployed version during implementation.

## Coordinate pairing

The collector writes latitude and longitude atomically with precisely the same timestamp, source and basis. Backend position reads select the latest complete pair for an entity and stream. Never independently select the latest value for each coordinate. A newer incomplete pair does not create a hybrid position; any older complete pair still must satisfy freshness. Observed positions take precedence over predictions only while valid. General clients still receive the existing combined position response. A derived latest-position projection is allowed, but is not authoritative storage.

When either coordinate changes, persist both components, even if the other component is unchanged. Pairing also matches coordinate-system and relevant definition dimensions. If historical coordinates have no source observation time, retain that fact in provenance and use an explicitly labelled effective/import time; do not claim it was a GPS observation. Fixed asset locations use inventory validity, not moving-vehicle expiry.

## Domain mapping checklist

| Existing domain | Measurements | Helper context |
|---|---|---|
| Sensor/TTN, smart-city, model weather | Temperature, humidity, rain, air index, parking counts, device diagnostics actually supplied | Source IDs, units, accumulation interval, model versus observation |
| Soil/irrigation | Temperature, moisture, tension, water-surface distance | Depth, % nFK versus other moisture definitions |
| Water/groundwater | Level, level change, discharge, depth, nitrate, published thresholds | Datum, station identity, threshold validity |
| Seismic | Waveform, PGV, RMS | Channel, sample time, processing window, calibration |
| Bus/train/waste/bike | Latitude, longitude, speed, heading, delay and supplied operational values | Vehicles versus trips, route/stop relationships, calendars, model version |
| Traffic/crossings | Counts, durations, observed state and supplied condition values | Incident descriptions/intervals, geometry, vehicle category, hourly versus daily totals |
| Chargers/energy | Connector counts/status, capacity, power, yield, supplied emissions estimates | Connector hierarchy, operator, cumulative versus period energy, calculation method |
| Demographics/social/commuters | Population, births/deaths, unemployment, tourism, commuter counts | Categories, origin/destination, reporting period |
| Housing/property | Buildings, dwellings, vacancies, floor area, rent, land value, permits | Zone boundaries, building/heating/age categories, reference date |
| Finance | Revenue, expenses, debt, reserves, taxes and rates | Fiscal period, product area, planned versus actual, document evidence |
| Elections | Votes, turnout, voters, seats | Election identity, district, party/candidate, vote type, boundaries |
| Economy | Registrations, closures, employment, supplied turnover | Industry, geographic scope, reported ranges/estimates |
| Agriculture/waste | Area, land share, tonnage, recycling rate | Crop/waste category, geographic geometry, reporting period |
| Facilities/connectivity | Capacity, enrolment, bandwidth, coverage | Opening hours, technology, facility/area identity |
| Environmental areas/noise | Area, noise values or band bounds | Polygons, metric, source/model basis |

Code categories have helper dictionaries; booleans use validated 0/1. Do not average categorical codes. Published ranges retain lower/upper bounds and inclusive/open-ended semantics; do not invent midpoints. Dates, identifiers, free text, routes and polygons are not numeric measurements. A source that only provides text categories may retain them in versioned descriptive metadata. Do not promote old seeded/example rows into trusted data.

## Implementation phases and acceptance gates

### 1. Inventory and migration manifest

Extend `ui-field-inventory.json` and `ui-data-coverage.md` into a machine-readable mapping of every stored/published field: old location, active writer, API consumer, entity identity, measurement/dimensions/unit, period, provenance and target helper where needed. Include disabled contracts and classify them as unavailable rather than populated. Inventory actual VPS row counts, time ranges, disk size and duplicate/conflicting samples; repository declarations alone do not establish production contents.

Inspect all ingestion routes, including telemetry single/batch endpoints and legacy bus/train/waste/admin writes. Include sensor edits/hiding/deletion, archives, CSV exports, health checks and source-status endpoints. Gate: every field has an explicit mapping or documented exclusion, and every writer/reader has an owner and migration step.

### 2. Additive schema and shared ingestion

Add versioned, restart-safe migrations for the three tables plus definitions/aliases, provenance, revisions and latest-value helpers. Avoid long backfills inside API startup (`main.py` currently executes `schema.sql`). Build shared ingestion operations for validation, definition lookup, batch writes, corrections and latest-cache maintenance. Package them for both API and independently built collector images.

Gate: migrations work on empty and existing database copies, run twice safely, and preserve old behavior. Validate atomic coordinates, precision, categorical constraints, definition uniqueness, retries and corrections with real database tests.

### 3. Pilot sensor migration

Convert telemetry API ingestion, smart-city, environment, Shake and Nextbike writers in manageable releases. Backfill `sensor_metadata`, `sensor_data`, smart-city provenance and related history in bounded, checkpointed batches. Compare sample identities and values, not only row totals. Historical duplicate/conflicting rows are preserved in revision/quarantine records until classified; no arbitrary last-row wins.

During transition, old and new writes for each migrated path share one transaction. Shadow-read new storage while old API responses remain authoritative. Register concurrent writes before beginning backfill and reconcile watermark overlap so backfill cannot overwrite a newer correction. Gate: source-specific parity, fresh latest values, unchanged history queries and archive output.

### 4. Movement migration

Convert `prediction.py`, realtime ingestion and active legacy position endpoints. Split every coordinate record into latitude and longitude readings with identical source timestamp; preserve basis, validity and model provenance. Keep schedules, stop times and trip updates as helpers. Backfill historical movement in small batches; build complete-pair latest projection.

Gate: exact trajectory parity, expired positions disappear, observed/predicted priority preserved, incomplete/mismatched coordinate samples never pair, stationary/hidden-tab behavior and smooth animation remain unchanged.

### 5. Registry and statistics migration

Normalize scalar fields in active `collected_datasets` and relevant dataset versions into the core model, using the reviewed mapping manifest. Cover Hessen, elections, budget review, charger inventory, OSM inventory, water, traffic and all other active adapters. Preserve raw payloads and publication manifests for evidence, completeness and expiry. Only publish a dataset version when all required measurements/context commit successfully.

Geometries, calendars, event descriptions and raw source documents stay in helpers. Old JSON publications may remain temporarily as compatibility projections; after cutover, numeric API values must derive from core readings, not a competing authoritative JSON store. Already-unavailable data remains unavailable. Gate: identical legitimate public values/units/periods, suppression preserved, no old demo resurrection, and budget inconsistencies remain flagged.

### 6. Read-path and archive cutover

Adapt existing endpoint responses to read new tables/projections; avoid requiring the browser to join scalar coordinates or download full histories. Switch individual domain readers behind configuration flags after shadow comparison. Preserve current URLs, public IDs, timestamps, units, expiry headers, error states and UI contracts. Add generic measurement/history endpoints only where useful, with bounded queries and pagination.

Update archive-worker SQL/counts/manifests/checksums, sensor management and all remaining legacy admin writers. Confirm that aliases handle existing external ingestion clients. Gate: API contract tests, archive round-trip checks, frontend tests and visual map verification pass; a browser network audit confirms domain data stays behind the VPS.

### 7. Capacity rehearsal and production rollout

Rehearse with a restored production backup on a separate database, verify restoration, estimate duplicate storage during migration and check free disk before starting. Benchmark numeric storage, batch ingestion, seismic load, history queries and latest-map projections on a 4 GB memory budget. Use bounded concurrency and checkpointed backfills. Keep public request coalescing/caching; 200 visitors must not multiply collection writes or prediction work.

Coordinate deployment with Watchtower so writers/readers do not upgrade in an uncontrolled order; use pinned release images. Order: backup and schema, compatible ingestion release, backfill/parity checks, read cutover by domain, full verification. Supply exact VPS commands per release once image tags and migration scripts exist. No full migration command is ready yet.

Gate: a representative 200-client scenario through the actual proxy/API path meets an agreed latency/error target, no OOM/restarts, bounded database connections, acceptable collection lag, and documented storage growth. Two coordinates alone for 100 continuously active objects at 10-second cadence mean 1,728,000 rows/day; add other metrics separately. Retention/compression/archive policy must be explicit; do not silently delete existing history.

### 8. Retirement and completion

Keep rollback-compatible old writes through a defined observation window covering live collection and daily registry refresh. Roll back readers with flags while old storage remains current. After old writes stop, rollback requires a tested reverse replay or restore procedure; switching a flag alone is insufficient.

Retire legacy paths only after mapping/parity and archive gates pass, monitor zero remaining readers/writers, and verify a recoverable backup. Dropping old tables is a separate explicit destructive step, not part of initial rollout. Final canonical measurements live only in the three core tables; helpers and rebuildable caches remain. Publish the resulting table inventory and operational runbook.

## Deliverables

1. Complete field-to-measurement manifest and reviewed schema contract.
2. Versioned migrations, shared writer and resumable backfill/reconciliation commands.
3. Migrated collectors, ingestion endpoints, API readers and archive worker.
4. Meaningful database/contract/UI tests and capacity evidence.
5. Staged VPS deployment/rollback commands and final table inventory.

No immediate VPS action is needed for planning. Production inventory and backup checks are the first VPS-dependent implementation steps.

### Implementation progress, 30 September

- Added explicit core migration, numeric readings, immutable definitions, revisions, latest-value projection and exact-timestamp coordinate joins.
- Added opt-in transactional sensor metadata/reading and movement shadow writers, checkpointed historical backfill, comparison audits and emergency pause.
- Added preliminary capacity checks before CLI shadow activation or backfill; production reports only 4 GB free, so neither has been started there.
- Restored the full 2.48 GB custom-format backup into a local PostgreSQL 16.15 / TimescaleDB 2.30.0 clone, with 4 GB memory and two CPU limits; backup is private and excluded from Git.
- Verified 30 Python integration/regression checks and 8 archive tests, including HTTP response/ETag parity and an actual export using canonical values instead of conflicting legacy values. Later backfill optimizations also passed the core suite. Remote CI has not run for these uncommitted changes.
- Normalized all seven live statistical publications and both charger publications on the clone; reconstructed JSON matches the source publications exactly. Missing occupancy stays missing. Reporting dates and source scales remain explicit.
- Verified the current sensor-map response for all 585 records is identical in both read modes. Indexed canonical map query measured approximately 56 ms locally versus 53 ms for legacy. This is not a multi-user load test.
- Fixed duplicate-batch boundaries, a global backfill sort, PostgreSQL float-to-numeric rounding, and the archive test's accidental inclusion of Timescale-only schema on plain PostgreSQL.
- Added shared five-second map snapshots with in-flight request coalescing and admin-change invalidation. A 200-request local ASGI burst during backfill used one database read and completed in roughly 0.42 seconds; this does not replace deployed proxy/frontend validation.
- Still pending: complete field manifest, source-aware canonical writers, remaining inventory/helper-domain mappings, full history/retention/load rehearsal, production read cutover and legacy retirement. Shadow sensor definitions deliberately retain unverified provenance/semantics instead of claiming measured data.

## Reviewable implementation packages

| Package | Principal code areas | Completion evidence |
|---|---|---|
| A: Inventory and contracts | `ui-field-inventory.json`, `ui-data-coverage.md`, schema and active SQL writers | All fields classified; migration mappings reviewed; production inventory captured |
| B: Schema and ingestion library | API migration/bootstrap, shared collector package, Docker build contexts | Additive migration replay, numeric precision and idempotency database tests |
| C: Sensors and histories | `endpoints/telemetry.py`, `endpoints/sensors.py`, `endpoints/map_sensors.py`, smart-city/environment/Shake/Nextbike storage | Backfill parity, corrections/deletion/hiding behavior, historical API compatibility |
| D: Movements | Registry prediction/realtime modules and bus/train/waste ingestion | Complete coordinate pairs, valid source priority and unchanged animation contract |
| E: Statistics and inventories | Registry publications, Hessen/elections/budgets/chargers/OSM/layers adapters, traffic storage | Exact values, dimensions, periods, publication completeness and source evidence |
| F: API and exports | Collected/domain endpoints, archive-worker, backend projections and caches | Old response contracts preserved; exports reconciled; no active legacy-only writer |
| G: Rehearsal and deployment | CI, Compose/image pinning, migration/backfill commands, runbook | Restore rehearsal, bounded-memory load checks, domain-by-domain cutover and rollback rehearsal |
| H: Retirement | Legacy SQL/readers/writers and obsolete schema declarations | Observation window passed; no live dependencies; separate reviewed cleanup |

Packages are sequential where they depend on schema or migration results. Sensor and movement pilots should be validated before bulk statistics migration. Each package includes its own relevant tests; do not defer all verification until deployment.

## Decisions to resolve with evidence during implementation

- Exact numeric representation and hypertable chunk/index settings: benchmark the actual data distribution, especially seismic samples. The single-value-column requirement is fixed; physical tuning is not.
- Dataset scale and migration duration: determine from production counts and a rehearsal rather than estimating from the 84 table declarations.
- Provenance completeness: where historical rows cannot be attributed to a trustworthy source, preserve them separately and exclude them from trusted publications until reviewed.
- Definition revisions and unit conversion: retain original source values/evidence, document conversion and prevent a changed definition from reinterpreting old values.
- Retention and compression: measure daily storage growth and propose explicit per-family policies before enabling deletion. Backups/exports need restoration checks, not merely successful upload logs.
- Rollback window: cover at least one successful daily refresh for each migrated daily source and a representative live workload; weekly inventories need an explicitly exercised refresh or a longer window.
- Source publication expiry and measurement time remain separate: a successful check of unchanged annual statistics can renew publication validity without generating a new population observation.

## Final acceptance checklist

- [ ] Every active scalar field has a stable definition, unit, source and temporal meaning.
- [ ] Latitude and longitude use ordinary scalar readings paired by timestamp; no observation ID or special position column in authoritative readings.
- [ ] All collectors and ingestion endpoints write through the new contract.
- [ ] History, revisions, source evidence and public IDs survive migration.
- [ ] Domain APIs, exports and map layers agree with trusted pre-migration data.
- [ ] No live numeric API path depends on old tables or authoritative JSON blobs.
- [ ] Map dialogs, icons, layers and smooth movement pass visual verification.
- [ ] Frontend data requests remain routed through the backend and caches.
- [ ] Performance, storage growth, production health and rollback evidence are recorded.
- [ ] Unavailable feeds and predicted values remain accurately labelled.
- [ ] Operational documentation lists the final core/helper tables and recovery steps.
