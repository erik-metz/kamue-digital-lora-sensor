# Remaining collector implementation plan

Planning baseline: 24 September 2026. The core refactor is local and tested, not deployed. This plan does not authorize production changes or delete stored data. See `collector-data-pipeline.md` for implemented adapters and current validation.

## Target and completion rule

Every dynamic UI field must have an identified database publication or native sensor record, a backend read endpoint, units, geographic scope, reporting time, freshness rules and a missing-data state. External acquisition runs only in VPS collectors. A missing integration is not completed merely by adding a configurable JSON endpoint. Simulated movement is always identified as predicted, with assumptions and coverage exposed.

Default geographic scope remains Bürstadt, Lampertheim, Biblis and Groß-Rohrheim. Replace inconsistent bounding-box totals with municipality membership where reliable boundaries are available; explicitly label regional bounding-box datasets until then.

## 1. Complete the data inventory and contracts

- Trace each visible metric, chart, map layer, popup and departure board through frontend helpers, Next routes and backend queries. Include native telemetry and any remaining legacy endpoints.
- Record dataset, provider, adapter, DB storage, endpoint, units, geography, source date, collection cadence, freshness semantics and coverage in a checked-in matrix.
- Classify each field as measured, officially published, derived, predicted or unavailable. Keep source time separate from collection time.
- Replace shallow JSON contracts with versioned typed validation, including nullable fields, ranges, units, municipality identifiers and authoritative empty responses. Do not require unsupported energy fields such as avoided CO₂ to publish valid meter readings.
- Separate historical publication validity from collector health: an old election result remains valid historical data even if the latest refresh fails. Live positions must expire promptly.
- Audit remaining embedded constants and remove obsolete production fallback modules after verifying their consumers. Constants used for styling or documented simulation parameters are permitted.

Acceptance: every displayed dynamic field appears in the matrix; no unidentified provider requests or invented default values remain in active UI paths.

## 2. Finish movement and basemap coverage

- Run and measure the complete regional ZAKB import in staging. Produce counts of streets/addresses attempted, successful calendars, rejected addresses and coverage by municipality and waste fraction.
- Determine whether street sections or house-number ranges have different dates. Expand sampling where required; do not label one address per street as full coverage.
- Add resumable collection, bounded concurrency, retry/backoff and conditional requests where supported. Preserve the last valid publication until its documented expiry; never publish a partial crawl as complete.
- Store schedule revisions independently from daily collection attempts. Preserve holiday changes and calendar cancellations.
- Improve transport updates to apply stop-specific timing, cancellations, skipped stops and amended trips. Define supported handling for frequency-based services and incomplete stop times; expose exclusions.
- Normalize/index departure stop times instead of repeatedly expanding every trip's JSON. Restore map stop popups using the stored departure API.
- Review rail source coverage and identifier compatibility before adding a realtime rail adapter. Provider discovery is required; no rail GPS feed is assumed.
- Complete the bounded basemap tile inventory and validate map bounds, zooms, missing-tile behavior and attribution.
- Keep ZAKB forecasts labelled as approximate collection activity. Calendar data cannot establish actual truck identities, route order or GPS. Road-following predictions may use a separately collected road graph, but must still disclose unknown route order and timing.

Acceptance: daily schedule refresh and shared prediction work across midnight, DST, holidays, cancellations, restart and provider failure; full regional collection has a coverage report; frontend never performs route simulation or provider fetches.

## 3. Populate the detailed domain pages

Implement one domain at a time: verify official source and reuse terms, capture representative responses, build collector/parser and validation fixtures, persist publications, map to the UI, then enable the source. The entries below are research targets, not claims that a working public API has already been verified.

| Priority | Domain | Remaining work / source discovery target | Completion evidence |
|---|---|---|---|
| 1 | Population and demographics | Map available HSL tables into chart contracts; verify age structure, commuters and facility sources through official statistical and municipal publications | Correct municipality/year/units; suppression preserved; no invented annual or live interpolation |
| 1 | Municipal budgets | Locate adopted plans, amendments and actual accounts on each municipality's official publications; parse structured exports or validated PDF tables | Source document/page provenance; planned versus actual explicit; financial categories and totals reconcile within documented rounding |
| 2 | Housing | Map published housing stock/construction; verify BORIS access, geography and reuse terms; locate official development plans | Reference dates and valuation zones correct; no invented property-market averages |
| 2 | Economy | Map published tax/employment/business statistics; verify further official registrations and industry tables | Definitions and geographic denominators match; directory entries are not treated as a complete business census |
| 2 | Elections | Extend beyond Bundestag 2025 using official municipal/state result exports; verify postal-vote grouping and boundary versions | Counts reconcile with official totals; no unsupported geographical aggregation |
| 2 | Environment | Verify Hessen sources for protected areas, groundwater, land use and locally applicable hazard coverage | Geometry/reference systems and measurement dates checked; missing local coverage remains unavailable |
| 3 | Infrastructure, social and closures | Verify broadband, public Wi-Fi, road conditions, facilities, waste statistics and closure sources | Measured coverage distinguished from absence of records; closure effective intervals respected |

Daily checks are the default for publication discovery, adjusted to provider limits. Reporting periods remain annual/quarterly/etc. as published. Rechecking a source does not manufacture newer observations.

Acceptance: all feasible public-source adapters are implemented and enabled; each remaining unavailable field has a documented provider/access blocker and explicit UI state. Detailed pages retain useful charts and navigation only where real publications support them.

## 4. Integrate live energy and charger status

- Discover regional operators and publicly documented feeds; record coverage, authentication, access terms, update cadence and identifiers. If operator access is required, document the exact provider and credential setup needed without requesting secrets in chat.
- Separate installed capacity, measured instantaneous output and accumulated energy. Compute derived quantities only with a documented method and suitable inputs; do not infer current local generation from national values or nameplate capacity.
- Model charger inventory and connector status separately. Match provider identifiers to inventory with reviewed mappings. Partial live coverage must be visible; unknown status never means available or occupied.
- Use configurable collector intervals matched to provider cadence. Initial targets are 30–60 seconds for live status and source-specific measurement expiry; confirm after feed verification.
- Store quality, measurement time, receipt time and source for each observation. Test out-of-order updates, offline devices and stale readings.

Acceptance: live values appear only for verified observed coverage; unsupported metrics remain unavailable. Population and budgets use latest official publications, not simulated live counters.

## 5. Operational reliability and storage limits

- Add per-source retry/backoff with jitter, timeout/size limits, heartbeat, import duration, coverage and last-success monitoring. Long imports must not block prediction ticks.
- Validate shared-lock recovery after process death, transaction rollback, concurrent worker starts and malformed provider responses.
- Reduce unchanged downloads using conditional requests when available and avoid duplicate parsed versions.
- Measure daily database growth with realistic active vehicle counts and raw payload volumes. Index common reads and verify query plans, especially departure queries.
- Proposed starting policy for new movement data: seven days of fine-grained history, optional five-minute aggregates for 90 days, small current-state projection. Size raw response retention separately by source and replay requirements. Implement configurable retention and a dry-run report first; activate deletion only after the policy is reviewed and backups are verified. Preserve historical official publication versions according to a separate policy.
- Make collector health and dataset availability visible in `/quellen`; distinguish disabled, pending, partial, failed, stale and healthy.

Acceptance: bounded growth policy is documented and tested; failure/restart tests preserve provenance and valid records; alerts identify the specific failing source.

## 6. End-to-end verification and staged rollout

- Run browser network verification through every page and map interaction: all data/tile requests stay on the application origin, and Next data requests go only to the configured VPS. Include error states and cold caches.
- Add critical end-to-end cases for populated, empty, missing, expired and partially covered datasets. Verify actual UI behavior and retain existing useful interactions where data supports them.
- Test through Next, Nginx and the API on staging with 200 active clients, initial page-load bursts, warm/cold caches and ongoing collectors. Use the real mix of map layers, movement polling and dashboard requests, not just one API endpoint.
- Proposed performance targets: under 1% unexpected errors, warm movement-read p95 below 500 ms, no missed ten-second predictor ticks under normal import load, and stable memory/DB connection use. Adjust against actual VPS specifications before treating these as release gates.
- Rehearse backup/restore, schema upgrade, image rollout and rollback against a copy of the existing database. Verify Nginx configuration and readiness version.
- Prepare production images and a deployment checklist. Production rollout is a separate action after the tested result and known unavailable datasets are reviewed.
- Roll out collectors/backend first, confirm populated publications and freshness, then switch frontend. Observe at least one daily refresh cycle and verify rollback remains possible.

Acceptance: the full request path handles 200 active visitors within the agreed targets, no browser/provider data traffic exists, and source coverage plus outstanding blockers are explicitly documented.

## Execution order and dependencies

1. Inventory and typed contracts.
2. Regional movement/basemap validation and indexed departures.
3. Population and budget integrations, then the remaining domain adapters.
4. Live-provider discovery can proceed during domain work; its integration depends on verified access.
5. Operational controls and storage measurements throughout implementation, before rollout.
6. Full-stack verification, staging soak and production handoff.

No firm completion estimate is assigned before the inventory and source-access checks: provider availability and PDF/export quality determine much of the remaining effort. The next implementation deliverable should be the field-level coverage matrix and a prioritized list of verified source adapters, followed by full ZAKB and basemap validation.

## Progress after the first implementation increment

- Added a reproducible inventory of 509 declared fields and an active UI coverage matrix. This includes legacy/inactive contracts and explicitly identifies remaining audit work; it is not full runtime coverage certification.
- Added indexed stop-time storage, migration backfill, atomic GTFS replacement, source-scoped departure reads and stored-departure map popups.
- Implemented versioned energy export validation, nullable missing measurements, unit consistency and CO₂ methodology requirements; removed the unused frontend generation simulator.
- Verified official budget discovery pages for Biblis and Lampertheim; documented adopted-versus-draft status. No budget parser or live energy integration was enabled.
- Validation: 105 frontend tests; 31 collector tests; 81 API tests plus 6 subtests, 4 optional skips; TypeScript and production build passed. Tests used a disposable database, now removed.
- Remaining next work: complete regional ZAKB/basemap staging collection, implement reviewed budget extraction and other detailed contracts, integrate native-worker status, then full-stack browser/load validation. Production remains unchanged.
