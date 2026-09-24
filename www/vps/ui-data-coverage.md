# UI data coverage audit

Audit: 24 September 2026. This is a code-path inventory, not a production network certification. The companion `ui-field-inventory.json` enumerates declared field names, types and source lines, including inactive legacy contracts. Regenerate it with `node www/vps/scripts/field-inventory.cjs`. Generic GeoJSON properties and official workbook cells are provider-defined and cannot be exhaustively listed as fixed TypeScript fields.

## Shared rules

Registry publications use `collected_datasets`, immutable input hashes in `collected_payloads` and versions in `collected_dataset_versions`. Backend route: `/api/v1/collected/{dataset}`. Next routes use the same-origin API or server-side VPS reads. Missing/expired publications return unavailable; authoritative empty arrays stay empty. Most domain reads use a five-minute Next cache bounded by publication expiry.

The nominal region is Biblis, Bürstadt, Groß-Rohrheim and Lampertheim. Charger and transport imports currently use the broader configured bounding box, not municipality polygons. Their totals must not be presented as exact four-municipality totals.

## Active UI paths and publication coverage

| UI / displayed fields | Dataset / database read | Collector, classification and cadence | Time, unit and coverage rules / remaining gap |
|---|---|---|---|
| Map sensor name, location, metric, value, unit, timestamp; header count; telemetry charts | `/map/sensors`, native `sensor_metadata`, `sensor_latest`, `sensor_data`; `/telemetry` | Native VPS collectors / observed readings; model weather explicitly labelled | Provider timestamps and metric units. Unknown count is not a fabricated count. Historic seeded native metadata needs production audit. |
| Official demographic tables: cell label, value, suppression marker, municipality, reporting year | `statistics/demographics` | HSL workbook, published, daily discovery | Units/reporting period in original labels. Rich age/cohort/commuter/facility contracts remain disabled. |
| Housing/construction official tables | `statistics/realestate` | HSL workbook, published, daily | Original reporting periods; no current house-price inference. BORIS, market benchmarks and plans not integrated. |
| Finance official receipts/payments and related tables | `statistics/finance` | HSL workbook, published, daily | Historical actuals, not adopted budgets. Detailed budget, spending and comparison contracts disabled. |
| Economy official tables | `statistics/economy` | HSL workbook, published, daily | Original categories and years; no invented company directory or startup totals. |
| Social official tables and events | `statistics/social`, `social/events` (see adapter mapping) | HSL daily; Cross7 Bürstadt six-hour refresh | Workbook dates and event occurrence times differ from collection time. Regional event coverage is incomplete. |
| Elections: precinct labels and published counts | `statistics/elections` | Bundestag 2025 official CSV archive, published, daily check | Historical 2025 results; no inferred postal-vote allocation or municipality boundaries. Other elections not connected. |
| Environment official land-use/agriculture tables | `statistics/environment` | HSL, published, daily | Historical units and dates. Protected-area and crop geometry, groundwater contracts missing. |
| Gauge water level, position, observation time | `environment/flood/gauges`, `map/layers/floods` | Environment worker / observed | Water level in source units; unknown thresholds remain null. Model weather is not a physical weather station. |
| Charger location/operator/connectors/capacity/counts | `infrastructure/ev-charging`, `map/layers/charging` | BNetzA inventory, published, daily check | Inventory reporting date; bounding-box scope. Occupancy unavailable. Available and occupied counts are nullable in the UI contract. |
| Energy current power, installed capacity, daily yield, by-type power, facility values, derived CO₂ | `infrastructure/energy`, `map/layers/energy` | No verified feed; disabled | Contract v1 now validates finite nonnegative numbers; unknown fields null, kW/MW consistency checked, CO₂ requires method. Frontend does not turn missing type readings into zero. |
| Broadband/roads/Wi-Fi details and maps | `infrastructure/broadband`, `road-conditions`, `wifi`; corresponding map layers | Unconfigured / disabled | Missing data shown unavailable. No measured network/road coverage can be claimed from old bundled constants. |
| Bus/train position, line, destination, timestamp, prediction basis | `/movements/latest`, `movement_latest` and `movement_positions` | Daily GTFS; VRN updates 30 seconds; shared prediction 10 seconds | Degrees, UTC timestamps; 30-second prediction validity. Shape or straight-line provenance. Stop-specific RT model still outstanding. |
| ZAKB collection movement forecast | Same movement tables; `movement_schedules` | Daily calendars; predictor 10 seconds | Sample addresses, assumed route ordering and 07–17 local timing. Full regional crawl and house-number-range coverage unverified. No actual truck identity. |
| Stop name/location and next departures | `transport/stops/{source}`, `movement_stop_times` joined to schedules/updates | Daily GTFS / published schedule plus reported updates | Source-qualified stop IDs prevent cross-feed collisions. Indexed stop projection; popup reads backend on open and aborts on close. Departures are not proof of GPS positions. |
| Basemap | `/map-tiles`, `collected_map_tiles` + raw payloads | BKG WMS, weekly | Regional zooms 8–14. Full inventory still needs staging collection. Missing tile does not fetch provider. |
| Source status: cadence, last attempt/success, enabled/status | `/collection/status`, `collection_sources`, `collection_attempts` | Worker registration and receipts | Collection success is distinct from observation freshness. Native workers not writing receipts need status integration. |
| Download/catalog/archive pages | `/sensors`, `/telemetry`, `/archives` through VPS | Native DB records and backend-managed archives | No external provider fetch; archive/download provenance and legacy DB contents remain audit items. |

## Remaining detailed contracts

Use the companion inventory to inspect every field in the following interfaces. Availability applies to the entire contract unless stated otherwise; the generic official-table page is a different real publication, not a synthesized implementation of these interfaces.

| Interface family | Planned publication prefix | Availability / next task |
|---|---|---|
| Municipality, DemographicSummary, AgeStructure, CommuterFlow, educational facilities | demographics/ | Disabled. Map exact HSL-supported fields; verify facility and commuter sources; relax unsupported mandatory metrics before enabling. |
| FinanceBudget, FinanceExpenditure, MunicipalFinanceComparison | finance/ | Disabled. Acquire adopted documents and validate totals, units, plan/actual and fiscal year. |
| Housing, BORIS, construction, market and development-plan interfaces | realestate/ | Disabled. Map supported stock/construction fields; verify remaining provider access and definitions. |
| Economy overview, companies, rates, registrations, industry, startup interfaces | economy/ | Disabled. Map supported statistics, do not fill directory/industry gaps with zeros. |
| Election and district interfaces | elections | Disabled. Precinct publication already exists separately; reconcile postal vote semantics before aggregation. |
| MunicipalIndicator, SocialKpiSummary, ZakbWasteStat, RegionalFacility | social/ | Detailed contracts disabled; events are the exception. Verify source coverage and denominators. |
| NatureArea, CropZone, AgriculturalStat, FloodGauge | environment/ | Only gauge publication and generic official tables currently collected. Geometry/hazard coverage requires verification. |
| RoadSegment, BroadbandArea, WifiHotspot | infrastructure/ | Disabled. Remove unsupported derived coverage/health assumptions before activation. |

## Audit findings and follow-up

- Fixed in this increment: all-trip JSON departure scans replaced by indexed stop rows; stop namespaces retained in GeoJSON/API; stored departures restored in map popups; unused browser energy simulator removed; energy unknowns and derived CO₂ validated.
- Legacy `/api/traffic` currently adapts native DB corridors with invented empty geometry/zero length. It is not used by the revised map, but should be moved to an explicit collected contract before being exposed again.
- Many bundled baseline arrays and movement fixtures remain in library modules for old tests. Active collector fetches no longer use them, but full removal requires separating fixtures and updating those tests.
- Typed validation is complete only for the new energy export contract; other generic JSON contracts still have shallow validation. Do not enable them solely because a URL exists.
- Final acceptance still requires browser network capture, complete native-collector provenance/status audit, source-level freshness rules and per-domain field mapping. This inventory does not claim those steps are finished.
