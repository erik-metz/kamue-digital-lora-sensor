# Bürstadt Smart City collector plan

Investigated 2026-09-14. The first collector implementation is now in
`smartcity-collector/`; see its README for supported metrics and deployment.
Expanded collection now also polls the main map and traffic dashboards, including
soil/tension, water coordinates and distinctly named traffic aggregate snapshots.
See the collector README for the current coverage and remaining unit gaps.
Historical backfill, streaming access, and a dedicated provenance UI/export
remain follow-up work. No production deployment or 24-hour pilot has been run.

## Findings verified against the public service

The dashboard is a Next.js application using `dashboard-service.smartcity-system.de` and `ngsi-service.smartcity-system.de`. Public GET requests worked without a login or token.

- Discovery: `https://dashboard-service.smartcity-system.de/dashboards/tenant/buerstadt?includeContent=true` returned 77 dashboards. This includes Lampertheim, regional stations, copies, and test dashboards; it is not a clean inventory of Bürstadt sensors.
- Targeted collection: `https://dashboard-service.smartcity-system.de/dashboards/76a90123-ba53-4d77-be9f-f11ef90dd63a?includeContent=true` returned the overview with its data (HTTP 200).
- Read entities from `panels[].widgets[].tabs[].query.queryData`, recursively following `widgetData.data.combinedWidgets`. Deduplicate repeated queries and entities. Prefer the query data over formatted `chartValues` and display labels.
- The overview response contained 370 distinct entity IDs: 250 WeatherObserved, 100 ParkingSpotSum, 8 ParkingGroup, 4 GreenspaceRecord, 3 AirQualityObserved, 2 FloodMonitoring, and one each of WeatherForecast, WeatherAlert and TrafficFlowObservedSumDailyCity. These are exposed entities, not 370 verified active physical devices.
- Individual current measurements are available. For example, `urn:ngsi-ld:WeatherObserved:IoT-Plan-Glatteis-70B3D57BA0006570` reported temperature 16.28 and relative humidity 94.19, both with `observedAt=2026-09-14T06:01:24.488Z`. Coordinates and names are also included.
- Water-level examples had observation times of 06:27 and 06:13 UTC that day. Some air-quality readings were from September 11 and a climate-box record was from January. A recent query `updatedAt` does not mean a recent measurement.
- Both NGSI-LD properties (`Property`, `observedAt`) and older NGSI-style properties (`Number`, `metadata`, entity `dateObserved`) occur.
- Parking includes per-location states/counts and group totals. Traffic includes hourly and daily sums. These must retain their source semantics.

### History and real-time limits

The frontend calls this public history endpoint:

```text
GET https://ngsi-service.smartcity-system.de/ngsi/on-demand-data/{queryId}
    ?entityId={encodedEntityId}&attribute={attribute}
```

Verified with query `08fd10e4-ffc6-4ac3-88f9-7c8d1020432c`, entity `urn:ngsi-ld:WeatherObserved:IoT-Plan-Glatteis-70B3D57BA0006570`, attribute `temperature`. HTTP 200 returned seven daily-spaced values for September 7–13. The response contained no explicit aggregation operator or sample counts; treat this as coarse history, not raw samples. Other chart query data includes hourly series, so resolution varies by query.

There is enough public data to build a history of individual latest readings by polling. This is near-real-time snapshot collection, not a verified event stream. Polling can miss intermediate changes; an aggregate cannot reconstruct them. Direct broker access, unaggregated historical queries, MQTT, WebSocket or subscription access have not been established. Ask the platform operator for a supported raw NGSI feed/subscription and retention/cadence details if lossless acquisition is required; do not depend on an assumed broker endpoint.

## Recommended implementation

1. Add `www/vps/smartcity-collector/` as an independent Python daemon with `main.py`, `config.py`, normalizer, tests, requirements, Dockerfile and README. Follow shake-collector's logging, retry and container conventions. Use HTTP polling instead of its CAPS streaming code.
2. Start with the single overview GET every 60 seconds, with jitter, bounded timeouts, one request at a time and exponential backoff for failures/429 (honor Retry-After). Make the interval configurable. Measure source timestamp changes over a day before increasing frequency; fetching faster cannot bypass the provider's cache/update interval.
3. Discover configuration daily, but keep an explicit dashboard/entity/metric allowlist for ingestion. Default scope is numeric observations and parking states surfaced by the overview. Add specific detail dashboards for soil, additional water levels or hourly traffic deliberately. Do not import every tenant entity, test/copy dashboard, regional station or tree automatically. Preserve actual geography; a Bürstadt tenant is not a city boundary.
4. Register one stable local sensor per source entity, independent of widget IDs. Use `scs-` plus a deterministic 40-character hash of tenant and full entity URN (fits the current 64-character ID field). Retain the full URN in a source mapping table. Map names and coordinates into sensor_metadata; canonical GeoJSON location is longitude/latitude, while the rendered map's position field can use reversed order.
5. Define a reviewed metric mapping: temperature, humidity, water-level delta, pollutants, parking counts/state, and explicitly named traffic sums. Resolve units from source configuration/documentation before publishing; quarantine unmapped units instead of guessing. Never equate a water-level delta with an absolute level. Parse numeric strings only for approved numeric attributes; skip nulls/nonfinite values and keep zero. Exclude forecasts, alerts and categorical text from the numeric telemetry MVP.
6. Use each property's `observedAt`, falling back to the source entity's valid `dateObserved`. Convert to UTC. Store fetch time separately. If neither source timestamp exists, retain the source snapshot for diagnosis without publishing it as a newly observed measurement. Do not timestamp unchanged readings with each poll time. Apply freshness rules per source type; unchanged parking states may be event-driven, whereas an old temperature reading indicates stale telemetry.
7. Persist deduplication and provenance transactionally in TimescaleDB (details below). Reprocess overlapping snapshots safely across restarts and failed acknowledgments. Do not rely only on an in-memory watermark or value comparison: identical values at different observation times are distinct readings.
8. Add the Compose service and a GHCR build/test job to `.github/workflows/ci.yml`, using the existing API/schema startup ordering and database environment conventions. Start with direct DB ingestion, which is already the deployed shake-collector default. Run the schema migration before the collector. No browser runtime is necessary.

## Database integration and semantics

Current `sensor_data` already supports `(timestamp, sensor_id, metric, value, unit)` and the public latest/raw/aggregate APIs. However, neither the table nor `/telemetry/batch` currently provides uniqueness/idempotency. Blindly submitting each poll would create duplicates and distort averages/counts.

Recommended first version:

- Add a `smartcity_sources` table mapping tenant + full entity URN to sensor_id, source URLs and identity metadata.
- Add a `smartcity_observations` ledger with a unique key on source entity + attribute + observation timestamp + resolution/aggregation identity; include payload hash, fetch time, provenance and the normalized value/unit. Store query IDs as provenance, not identity, so duplicate widgets do not create duplicate telemetry.
- Within one database transaction, lock/upsert the ledger record and insert into sensor_data only for a newly accepted observation. Advance checkpoints in that transaction. Restrict each entity/metric to one approved semantic mapping.
- A corrected value at the same source key updates the collector-owned sensor_data row and ledger atomically; record the revision. Unit/semantic mapping changes require an explicit migration or a new metric identity. Do not append a second conflicting reading silently.
- Keep aggregate imports out of the individual-observation path. A later `smartcity_aggregates` table should preserve window start/end, operator, resolution, source count when available, and provenance. Unknown aggregation semantics remain unknown. Never mix daily means, forecasts or rolling traffic sums with instantaneous readings, or sum overlapping 24-hour totals.
- Keep raw source snapshots under a bounded retention policy for parser diagnostics. Do not embed the full dashboard response indefinitely in each reading.

This avoids changing uniqueness rules for existing Shake/TTN data. A later API-ingestion mode would need an idempotent backend endpoint executing the same ledger + telemetry transaction; the existing batch endpoint alone is insufficient.

Existing latest/raw APIs can serve normalized observations immediately. Metadata/provenance and freshness need exposure in the API/UI so users can see source and observation age. Existing monthly archives cover sensor_data; extend exports explicitly for provenance and any future aggregate table. Historical corrections may require rebuilding affected published archive months.

## Validation and rollout

- Save small public-response fixtures for nested combined widgets, both NGSI formats, property timestamps, dateObserved fallback, null/zero/string values, coordinate ordering, duplicate widgets and stale records.
- Test poll replay/restart, concurrent ingestion, transaction rollback and same-timestamp corrections against PostgreSQL/TimescaleDB. Verify repeat polling leaves row count unchanged and new timestamps insert even when the value is unchanged.
- Test that missing timestamps, forecasts and unknown units do not enter observation telemetry; aggregate data must not enter that path either.
- Run a dry-run inventory first. Compare selected normalized readings with their public source JSON, then collect a small allowlist for 24 hours. Measure freshness, source cadence, failures, inserted/duplicate/revised rows and actual storage volume.
- Enable all reviewed overview metrics after the pilot. Add history/backfill only where window semantics are established. A snapshot collector cannot recover samples lost during an outage unless a suitable historical endpoint is available.
- Health reporting should distinguish successful HTTP fetches from new measurements. Log last successful fetch and latest source observation age per entity/metric, plus parse failures and skipped attributes.

## Remaining decisions to resolve during implementation

- Exact geographic scope: the supplied overview spans Bürstadt, Lampertheim and regional sources. Retain that scope initially, with clear station labels, unless narrowed explicitly.
- Unit mappings and source update intervals; raw sample vs processed value semantics for individual attributes.
- Whether finer historical resolution or a supported streaming API is available from the operator. Public snapshot access is verified; lossless streaming is not.

Suggested delivery order: normalizer and dry-run inventory → transactional schema/ingestion → container and CI → 24-hour pilot → optional history and additional dashboards.
