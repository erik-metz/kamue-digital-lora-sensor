# CAMS pollen adapter — step 3

Optional collection for six species (alder, birch, grass, mugwort, olive,
ragweed) at the same four municipality reference points as the soil adapter.
CAMS Europe has approximately 11 km resolution; multiple points may return the
same raster cell. Coordinates describe model cells, not measuring stations.

## Activation

Deploy the updated images, then execute `python measurement_migration.py install`
from `www/vps/api/v1` against the intended database. The step-1 environment
contract is required; ordinary `migrate.py` does not install it. Set
`ENABLE_POLLEN_FORECAST=true` in the Compose environment and recreate the
collector. Default is disabled to permit rollout before migration. No production
deployment or activation is performed by this repository change.

`POLLEN_POLL_SECONDS` defaults to 10800 (three hours) and cannot be lower.
Source failures, including malformed/uncommitted responses, respect this cadence.
They do not undo the other environment writes. Status contains an independent
`pollen` section; health expires after three configured pollen intervals without
successful ingestion. Valid responses containing only NULLs are a successful
retrieval with unavailable coverage, not a zero-pollen report.

## Forecast identity and provenance

The Open-Meteo Air Quality API exposes no provider issue/run timestamp. Do not
invent one from retrieval time or borrow the ICON run time. Each exact archived
response is identified by SHA-256. All four municipalities commit atomically.
Definitions use the existing `environment-v1` contract, `data_kind=model`, core
basis `model`, and dimensions `species` plus `snapshot_sha256`. Provenance
explicitly declares `product_type=forecast`, `forecast_identity=response_snapshot`,
`provider_issue_time=NULL`, and the acquisition timestamp `snapshot_at`. This is
a modeled forecast product with unknown issue time, not an observed reading or
an identified model initialization run. The common kind=forecast filter is for
identified runs and does not include these snapshots; use the pollen endpoint
or kind=model with the pollen entity to inspect them.

Receipt source, archived bytes/checksum, snapshot acquisition time and normalized
values are checked together before persistence. HTTP/parse failures cannot clear
prior results. Replaying identical bytes only confirms the source check; changed
responses form separate immutable snapshot series, preserving previous states.
No source response is reconstructed or aggregated before archiving.

## Coverage and validation

Documentation: https://open-meteo.com/en/docs/air-quality-api

CAMS pollen is European and season-dependent, with approximately four days of
forecast. The adapter requests the API's five-day response; the missing tail is
retained as `quality=missing`, value=NULL. A numeric zero remains valid zero.
Missing variable arrays, wrong units, wrong point count, invalid timestamps,
negative/nonfinite values or inconsistent lengths reject the entire batch.
No allergy burden thresholds are inferred from pollutant AQI bands.

Attribution: CAMS European Air Quality Forecasts, ENSEMBLE / Open-Meteo, CC BY 4.0.
Check hosted-service noncommercial eligibility or subscription before activation.

## API and display

`GET /api/v1/environment/measurements/pollen` selects the latest successful
archived response, without mixing snapshots. It returns all available upcoming
hourly values, qualities, species, units, coordinates and provenance for visible
entities, plus last successful check and explicit unknown provider issue time.
Bounds/truncation prevent silent partial output. Old snapshots remain available
through the generic measurement endpoint using the entity identifier.

`/umwelt/pollen` is linked from `/umwelt`. It shows daily peaks only when 24
unique UTC hours are valid, plus coverage counts and the full hourly table.
Seasonal gaps and partial days stay missing. Data without a successful source
check in nine hours are labeled stale. No fabricated burden classes are shown.

## Verification

`tests/fixtures/cams-pollen-20261006.json` is the exact live four-point response
retrieved 6 October 2026: 2,880 scalar values, including 552 NULLs in the missing
forecast tail. Tests cover seasonal gaps vs zero, units, malformed timestamps,
receipt tampering, replay, snapshot separation, latest-snapshot API selection,
visibility, cadence, independent health and retained base writes on failure.
Frontend tests cover complete zero days, incomplete/duplicate hours and species
separation. CI also executes the database contracts against TimescaleDB.
