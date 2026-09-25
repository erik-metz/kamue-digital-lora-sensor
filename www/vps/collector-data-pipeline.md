# Collector-owned UI data

The browser calls same-origin Next endpoints. Next reads only the VPS API. The VPS API reads stored database records; it never contacts providers to satisfy a page request. Provider acquisition and movement prediction run in the VPS workers, independently of visitor count.

## Storage and freshness

`collected_payloads` archives source response bodies by SHA-256. `collection_attempts` records acquisition outcomes. `collected_datasets` holds the latest normalized publication, with source time, collection time, expiry and input hash; `collected_dataset_versions` retains published revisions. Missing and expired publications return HTTP 503, not seed/example values. Source dates are not reset merely because an old measurement was downloaded again.

Daily GTFS imports populate `movement_schedules`. The predictor runs once every ten seconds and writes timestamped `movement_positions` plus the small `movement_latest` projection. Observed positions take priority over schedule predictions. Each record has an explicit `basis`, validity limit and source/model identity. Quantized ticks prevent duplicate historical samples. Reads do not run simulations. Departures are queried from stored stop times and fresh trip updates.

The current delay model applies the next reported stop's delay to the trip trajectory. This is explicitly labelled an approximation; it does not implement a complete stop-by-stop GTFS-RT routing model. Frequency-based trips and trips missing stop times are excluded. The public VRN response tested contained TripUpdates, not GPS VehiclePositions.

The frontend and Nginx cache public reads, including five-second sensor inventory snapshots. Nginx coalesces concurrent cache misses. Movement batches have a five-second cache lifetime; the map polls once per ten seconds and stops polling while hidden. Statistics use a five-minute Next data cache. Source expiry headers are checked even when Next returns an older cached response. No stale-on-error proxy rule is enabled. CSP restricts browser data and image connections to the application origin (plus embedded images).

## Public sources implemented

| Source | Cadence | What is actually available |
|---|---|---|
| [VRN timetable](https://opendata.vrn.de/datasets/vrn-und-rnn-gtfs-sollfahrplandaten-aktuell) | Daily | Regional schedules and provider shapes where present; this feed excludes rail |
| [VRN realtime](https://opendata.vrn.de/datasets/vrn-und-rnn-gtfs-realtime-echtzeitfahrplandaten) | 30 seconds | Reported trip/stop updates; not assumed to be vehicle GPS |
| [GTFS.de regional rail](https://gtfs.de/de/feeds/de_rv/) | Daily | Regional rail timetable derived from DELFI, bounded to trips touching the Ried area |
| [ZAKB calendar](https://www.zakb.de/abfallkalender) | Daily | Address-specific collection dates; representative OSM address per street, not full household coverage |
| [BNetzA register](https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/E-Mobilitaet/DownloadundKontakt.html) | Daily check | Charger inventory/capacity; occupancy remains unknown |
| [Hessen municipal statistics](https://statistik.hessen.de/publikationen/hessiche-gemeindestatistik) | Daily check | Published population, housing, finance, economy, agriculture/land-use and social tables, retaining their original reporting periods and units |
| [Bundeswahlleiterin precinct results](https://www.bundeswahlleiterin.de/bundestagswahlen/2025/ergebnisse/weitere-ergebnisse.html) | Daily check | Bundestag 2025 precinct results; no inferred municipality totals or invented election boundaries |
| Cross7 Bürstadt | Six hours | Public calendar events |
| [BKG TopPlusOpen](https://gdz.bkg.bund.de/index.php/default/wms-topplusopen-wms-topplus-open.html) | Weekly | Precollected map tiles, zooms 8–14, regional bounds; higher browser zooms enlarge stored tiles |
| Existing environment worker | Configured worker cadence | Pegelonline water levels and DWD ICON model weather, persisted before display |

The ZAKB movement is a **collection forecast**, not a tracked truck: a nearest-neighbour ordering of sampled addresses and assumed uniform 07:00–17:00 timing. Straight segments are identified as approximations. No invented license plates, fleet identities, loads or completion measurements are published. A public collection calendar cannot establish actual fleet positions.

The municipal workbook does not contain every field in the previous dashboard. When the detailed publication contracts are unavailable, the corresponding pages display the collected official tables, including original years, instead of fabricated charts. `/umwelt` and `/wahlen` expose the collected environment and election tables. Municipal receipts/payments are explicitly distinguished from adopted budget plans.

## Still unavailable / limitations

`sources.json` explicitly disables unconfigured detailed export contracts. These are integration contracts, **not completed provider adapters**. Outstanding details include adopted municipal budget plans, BORIS polygons and market benchmarks, schools/commuter records, company directories, municipal election boundaries/results beyond Bundestag 2025, protected-area/crop geometry, road condition/broadband/Wi-Fi sources, and a collected closure feed. The shared map reports missing layers. Its old fabricated route overlays, crossing predictions and fabricated detail popups are no longer displayed.

No verified live regional energy meter feed or live charger occupancy feed is configured. Their values remain unavailable. Polling a population publication or a charger inventory more often cannot turn it into a live measurement. Public-source discovery should continue for the remaining detailed contracts; operator feeds can be enabled server-side without changing the frontend boundary.

The BKG rain-risk layer is not enabled: the verified published coverage did not include Hessen. No replacement hazard map is invented. The basemap must be collected before it appears; tile misses never trigger an upstream provider call.

## Capacity for 200 visitors

At a ten-second movement polling interval, 200 visible pages produce approximately 20 requests/second to Next, each returning one batch. Shared five-second caching greatly reduces VPS/database reads. Collection and prediction writes stay constant as visitor count changes.

A local ASGI/TimescaleDB test with real imported schedules and freshly persisted positions completed 200 requests spread over ten seconds, all HTTP 200. The response was about 17.7 KB; measured median was 13.23 ms and p95 23.48 ms. This excludes network latency, Nginx, Next and actual VPS resource limits, so it is not a production capacity guarantee. At that uncompressed response size, 20 requests/second is about 354 KB/second; JSON compression reduces transfer further.

Storage is the longer-term concern: 100 continuously active entities at one sample every ten seconds generate 864,000 historical rows/day, regardless of visitor count. Actual trips are not active all day. Raw archives and movement history currently have **no automatic deletion policy**. Before production, set an explicit retention/archive policy and monitor database size, collector lag, import duration, errors and API latency. Do not delete history implicitly during this migration.

## Validation performed

- Schema migration applied twice to an isolated TimescaleDB instance.
- Collector suite: 19 tests including real database publication/prediction replay and expiry checks.
- API suite: 79 tests and 6 subtests passed, with 4 optional tests skipped. An additional real-database source-status regression test passed after correcting the SQL union's nullable column types.
- Environment collector: 3 database tests passed, including preservation of real readings across schema initialization.
- Frontend suite: 104 tests, TypeScript check and production build passed during the refactor.
- Actual imports succeeded for BNetzA, VRN timetable/realtime, GTFS.de rail, Hessen workbook, Bundestag precinct results, Cross7 events and the environment worker (one water gauge and three weather metrics).
- BKG PNG acquisition and one ZAKB address calendar download were smoke-tested. The full regional ZAKB crawl was not run; coverage and rejected addresses must be reviewed on the VPS.
- The real regional timetable imports yielded 9,480 VRN and 1,317 rail trip/day records across the imported service dates in this test run. These counts are test observations, not constants.

## Deployment

The user reports deploying the earlier refactor; see `continuation-validation.md` for the public endpoint mismatch and follow-up changes. This task has not mutated production. Automatic demo-data INSERT statements have been removed from the schema, so startup cannot overwrite collected values with examples. Existing legacy rows are preserved and are not promoted into collector publications. Build the revised backend, registry worker, environment worker and frontend images. Back up the database; apply `api/v1/migrate.py` using the existing deployment environment, then verify `/health` requires schema version 20260928. Deploy the read API and Nginx cache configuration, start collectors, inspect `/api/v1/collection/status` and publication freshness, then deploy the frontend. Initial imports can take time, especially ZAKB and map tiles. Do not mark source acquisition complete merely because a container is running.

The manifest is mounted read-only at `/app/sources.json` by Compose. An enabled `json` source must provide the declared normalized dataset contract, a timezone-aware `source_updated_at`, an HTTPS URL and any token through an environment variable. Validate its field meanings and types against consumers before enabling it. Never insert the old frontend baseline arrays into the publication tables.

## Follow-up implementation (24 September 2026)

The declared-field inventory and active-path coverage matrix are in `ui-field-inventory.json` and `ui-data-coverage.md`. They explicitly distinguish active datasets from disabled legacy contracts.

Schema 20260928 adds an indexed `movement_stop_times` projection, one-time backfill from stored GTFS schedules and cascading replacement on schedule refresh. Stops retain their source namespace through map layers and departure requests. Map popups fetch stored departures on open.

The energy JSON export now requires `contract_version: 1` and an observation timestamp matching the publication time. Missing measurements are normalized to null; kW/MW totals must agree; CO₂ figures require `co2Method`. At least one measured generation/yield value is required. Facility capacity and daily yield are optional. No live energy provider has been enabled.

Follow-up verification: 105 frontend tests and TypeScript checks passed; 31 collector tests passed including real database import replay/backfill; 81 API tests and 6 subtests passed with 4 optional tests skipped. The production build passed with network access for build-time font downloads.

Follow-up: resumable ZAKB/BKG acquisition, bounded retries and the Biblis adopted-budget summary/review adapter are documented in `continuation-validation.md`. The complete regional tile import was validated; full calendar coverage remains incomplete.
