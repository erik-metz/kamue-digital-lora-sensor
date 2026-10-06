# Environmental data rollout — step 1

Scope: additive storage/import contract and public bounded reads. No new provider
is enabled and no production deployment is performed by this change.

## Install

Run `python measurement_migration.py install` from `www/vps/api/v1` against the
intended database after deploying the API image. The migration is idempotent and
uses the existing measurement migration lock. Ordinary `migrate.py` applies the
legacy schema only; it does not install this explicit measurement-core migration.

## Ingestion contract

New environmental and energy scalar adapters call the database function
`write_environment_measurement`. Register the entity first and archive the exact
HTTP payload in `collected_payloads` plus a `collection_attempts` receipt. Only
2xx receipts in `received` or `success` state matching the supplied source are
accepted. Acquisition failures must not call the writer. The receipt supplies
collection time and payload checksum; metadata cannot override those fields.
The adapter remains responsible for metric/unit validation and correct source parsing.

Data kinds:

- `observation`: source measurement; core basis `observed`.
- `model`: modeled value; core basis `model`.
- `forecast`: modeled future/historical forecast target; core basis `model`,
  with a mandatory explicit provider issue/run time.
- `derived`: calculated scalar; core basis `model`, with a mandatory method.

All imports require metadata `license` and `spatial_reference`. Model/forecast
imports also require `model`; derived imports require `method` (include its
version and input lineage). Supply provider URL, attribution and grid resolution
as additional metadata where available. Region-wide energy data must identify
its bidding area rather than pretend to describe a local generating facility.

Caller dimensions describe stable identity, e.g. soil depth, taxon, geographic
area or processing version. `contract`, `data_kind`, `issued_at` are reserved.
Forecast issue time is normalized to UTC and added to definition identity, so
multiple runs coexist for the same target time. Do not invent a provider run time
from acquisition time: if absent, block the forecast adapter pending a documented
snapshot-identity design. Retrieval time is not the issue time.

`p_time` is the valid/source time, never the download time. Intervals use
`p_start` / `p_end` and the existing core semantics (e.g. `period_total` for
rainfall or evapotranspiration totals). Units retain depth and averaging meaning
in dimensions/semantics. Missing/suppressed/invalid readings have NULL values;
valid readings require finite values. A repeated identical receipt is idempotent;
newer corrections retain previous records in `reading_revisions`; older receipts
cannot replace newer corrections. Runs cannot have an issue time after receipt.

Existing legacy imports are unchanged. Do not combine forecast latest values
with current observations; select the data kind and run explicitly.

## Public reads

`GET /api/v1/environment/measurements?entity_id=...` returns only new
`environment-v1` measurements for visible entities. Optional filters: `kind`,
`metric`, `start`, `end`, `limit`. Start is inclusive, end exclusive; timestamps
must carry a timezone. Maximum window: 31 days. Default window: last 7 days plus
next 7 days. Maximum 10,000 records, with an explicit `truncated` flag; subdivide
the time range or filter metrics if needed. Results include dimensions/run,
source, basis, valid time, interval, quality, collection time, revision and full
provenance. No aggregation or fallback is performed. Until installation, returns
503. The existing canonical CSV exports retain definitions and provenance too.

## Verification and remaining steps

`test_measurement_core.py` includes real database tests for receipt rejection,
forecast-run separation, retries, corrections, NULL missing values and public
visibility/provenance. CI runs these against TimescaleDB; local PostgreSQL tests
alone do not prove Timescale behavior.

Next, after user approval: soil/evapotranspiration/radiation adapter. Subsequent
steps: pollen, GBIF, flow forecasts, ENTSO-E and actual Sentinel raster indices.
GBIF occurrences need an event-specific contract; this scalar writer does not
represent occurrence records. Raster quality masking and processing belong to
the separate Sentinel step, not this foundation.
