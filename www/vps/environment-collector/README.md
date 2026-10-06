# Environment collector: soil forecasts (step 2)

The optional soil adapter imports an explicit **ICON Global initialization run**
from Open-Meteo's Single Runs API for four reference points: Bürstadt,
Lampertheim, Biblis and Groß-Rohrheim. Model resolution is approximately 11 km;
three pilot points may select the same raster cell. Requested coordinates and
returned grid coordinates are both retained. These are model forecasts, not
station measurements or municipal area averages.

## Enable after migration

1. Deploy the updated API and collector images.
2. From `www/vps/api/v1`, execute `python measurement_migration.py install`
   against the intended database. Ordinary `migrate.py` is insufficient.
3. Set `ENABLE_SOIL_FORECAST=true` and optionally `SOIL_POLL_SECONDS=3600` in
   the Compose environment. The feature defaults to **disabled** for a safe
   rollout against databases without the explicit measurement migration.
4. Recreate the environment collector and inspect `/data/status.json`, its
   `soil` section and Docker health. No production deployment is performed by
   this repository change.

Polling is at most hourly, including HTTP failures and uncommitted/invalid
responses. The adapter selects the newest six-hour initialization cycle at
least eight hours old, conservatively allowing time for publication. An
unavailable run remains a visible failed attempt; no fabricated run identifier
or current-time replacement is used. The API's `run` denotes initialization,
not the provider's later publication time. The other environment sources keep
collecting when this optional adapter fails. Soil health expires after three
hours without successful ingestion (independently of the five-minute base poll).

## Variables and meaning

- Volumetric soil moisture: 0–1, 1–3, 3–9, 9–27, 27–81 cm; `m3/m3`.
- Soil temperature at 0, 6, 18, 54 cm; degrees Celsius.
- FAO-56 reference evapotranspiration ET₀ and modeled evapotranspiration;
  millimeters totaled over the preceding hour.
- Shortwave radiation; `W/m2`, averaged over the preceding hour.

Seven days of hourly output are requested; provider horizon and availability can
leave partial days. Values before initialization are ignored. NULL remains
`quality=missing`; wrong units, malformed/partial point lists, duplicate or
non-hourly timestamps and nonfinite/out-of-range moisture reject the whole soil
batch. Exact response bytes are archived before parsing. Persistence rechecks
that the bundle matches the receipt and normalizes identically. All four points
commit atomically, using the step-1 environment contract and its replay/revision
rules. Different model initialization runs coexist. An unchanged response for an
already stored run only confirms a successful source check, without creating
new measurement revisions.

## API and display

`GET /api/v1/environment/measurements/soil` returns the latest stored run per
visible municipality for the current UTC day and six following days, including
units, depths, timestamps, intervals and provenance. It never combines runs.
A bounded `truncated` flag prevents silently presenting incomplete results.

The frontend route `/umwelt/boden` is linked from `/umwelt`. It shows daily
surface-soil means, radiation means and evapotranspiration totals plus an
expandable hourly table for all depths. A daily figure needs 24 unique valid
hours; otherwise it is missing. Interval totals belong to the day on which their
interval starts, including the interval ending at the following midnight.
Source checks older than three hours or initialization runs older than
18 hours are labeled stale. No irrigation advice, measured
local production, UV index or synthetic water balance is introduced.

## Sources and verification

Documentation: https://open-meteo.com/en/docs/single-runs-api and
https://open-meteo.com/en/docs/dwd-api. Attribution: DWD ICON / Open-Meteo;
data CC BY 4.0. The public hosted service's free access is for noncommercial
use; verify eligibility/limits before enabling it for a commercial deployment.

`tests/fixtures/icon-global-20261006T00.json` is the exact four-point live response
retrieved on 6 October 2026, for initialization 00 UTC, with all twelve variables.
It contains 8,064 scalar values including eight NULLs. Tests cover this fixture,
units, depths, interval semantics, failed receipts, atomic replay, separate runs,
poll cadence and optional-source health. CI runs the storage tests on TimescaleDB.
