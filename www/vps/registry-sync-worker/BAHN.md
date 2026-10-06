# Bahn infrastructure collector

The existing registry worker now collects DB InfraGO OpenStation alongside the
existing GTFS schedule and GTFS-RT jobs. No additional service or database migration
is needed. Next.js/Vercel reads stored publications through the existing FastAPI
publication endpoint; browsers never receive DB credentials.

## Public feeds enabled by default

- NeTEx: `https://bahnhof.de/daten/netex`, daily. Mobilithek ID
  `879076212433727488`. Disk-backed download, raw payload archival, streaming XML
  parsing and atomic publication. The import shares the large-import concurrency
  gate with GTFS and does its XML parsing outside the async event loop.
- SIRI FM: `https://bahnhof.de/daten/siri-lite/fm.xml`, every 60 seconds, using the
  realtime connection slot. Mobilithek ID `930558234532405248`. Requires a fresh
  station inventory; accepts feed timestamps at most five minutes old and one
  minute in the future. The API expires facility snapshots after five minutes.

DB recommends these redirect URLs rather than hard-coding Mobilithek IDs:
https://github.com/dbinfrago/openstation-docs

The explicit corridor inventory now covers 24 stations: Frankfurt Hbf,
Niederrad, Stadion, Zeppelinheim, Walldorf (Hess), Mörfelden, Groß Gerau-Dornberg,
Groß Gerau-Dornheim, Riedstadt-Wolfskehlen, Riedstadt-Goddelau, Stockstadt (Rhein),
Biebesheim, Gernsheim, Groß Rohrheim, Biblis, Bobstadt, Bürstadt, Lampertheim,
Mannheim-Waldhof, Luzenberg, Neckarstadt, Handelshafen/Jungbusch and Mannheim Hbf,
plus Hofheim (Ried) on the neighbouring branch. This is a configured station
inventory, not a claim of complete track or operational-site coverage.
Names and EVA codes were checked against the public NeTEx export. Edit
`station_names` or supply `eva_numbers` in `sources.json` to change coverage.
The expanded inventory appears after the deployed worker's next NeTEx import;
an older publication still correctly displays its own station count.
Missing configured station names reject the refresh, preserving the last valid
publication. A stopped or failing collector does not extend its expiry.

Publications:

- `GET /api/v1/collected/transport/bahn/stations`: station records, all reported
  EVA/DS100 codes, normalized IDs and infrastructure components (platforms,
  entrances, access spaces, stairs, lifts, equipment places and others).
- `GET /api/v1/collected/transport/bahn/facilities`: local lifts/escalators/
  travelators matched by normalized DIID URI, with `available`, `notAvailable`,
  `partiallyAvailable`, or `unknown`, plus the provider's description.

Coordinates are retained only when explicitly supplied for that object. Missing
coordinates remain null; a platform centroid is never assigned to its station or
lift. EquipmentPlace references are resolved station-locally using exact XML provider
IDs. Each component retains its own `coordinates` unchanged and gets a separate
`locations` list with `basis=own` or `basis=equipment_place` and the source object's
normalized ID. Multiple reported equipment places remain multiple locations;
parent centroids and unresolved/cross-station references are never used as a
fallback. Structural `container_ref` records containment independently of
provider-supplied `parent_ref`. Some platform/sector objects share normalized
DHIDs in DB's export; unique provider IDs preserve those distinct objects. Provider
IDs and normalized URIs are both preserved. No join uses station name or guessed
EVA numbers. Missing SIRI records are `unknown` with `status_basis=not_reported`;
unknown states and absence never mean operational. A reported unavailable state
does not establish the cause of an outage. These are infrastructure records,
not sensor measurements or live train positions. OpenStation data is CC0.

## Optional authenticated REST sources

`db-ris-stations` and `db-fasta` are registered but disabled. Subscribe to the
corresponding products at https://developers.deutschebahn.com/, supply
`DB_CLIENT_ID` and `DB_API_KEY` to Compose, confirm the response contract for the
subscription, then enable the desired source in the manifest. Credential values
are resolved into request headers at runtime and never stored in the manifest.

RIS queries the configured EVA numbers sequentially, once per day, and publishes
`transport/bahn/ris-stations/{eva}` only when the whole configured request set
succeeds. DB's `stopPlaces` objects are preserved without guessing coordinates or
remapping the subscribed API schema. Each response additionally includes
`station_identity`: requested EVA, exactly matched OpenStation IDs, DS100 codes,
match basis and an ambiguity flag. All EVA aliases participate; unmatched or
ambiguous records remain explicit. This identity join does not pick a historical
RIS version or invent coordinates. The optional RIS request set now mirrors all
EVAs in the 24-station inventory, within the adapter's 32-request bound. FaSta publishes
`transport/bahn/facilities-fasta`; configure **station_numbers**, not EVA numbers,
using the station inventory's `station_number`. It preserves ACTIVE/INACTIVE/
UNKNOWN and uses its own dataset, so it cannot overwrite SIRI. FaSta attribution
is DB InfraGO AG, CC BY 4.0; it does not inherit OpenStation's CC0 license.
REST snapshots without provider observation timestamps explicitly declare
`timestamp_basis=fetched`.

## Timetable/event correlation and further reference layers

The current GTFS prediction pipeline continues to supply estimated train
movements. These infrastructure adapters do not attach DB delays to GTFS trips by
name/line guessing. DB RIS::Boards provides public departure/arrival boards,
whereas RIS::Journeys provides journey details:
https://developer-docs.deutschebahn.com/doku/apis/ris-boards-10686900

A production RIS realtime join requires an activated subscription, sampled
responses and an explicit trip-instance crosswalk (including service date), not
just a station EVA. No RIS::Journeys/Boards realtime import or causal sensor-event
assignment is claimed by this change. A nearby scheduled or predicted train is a
correlation candidate, not proof that it caused a noise/vibration peak.

Parking occupancy, DB route GeoJSON/DS100 kilometrage and noise-protection layers
also require verified concrete downloads/contracts; they are not silently enabled
from catalogue descriptions. The existing OSM rail geometry remains authoritative
for the current interpolation until a separately verified track layer is imported.

## Verification and operation

```
PYTHONPATH=www/vps/registry-sync-worker python -m pytest -q www/vps/registry-sync-worker/tests/test_bahn.py
python www/vps/registry-sync-worker/main.py --dry-run
python www/vps/registry-sync-worker/main.py --job db-openstation-netex
python www/vps/registry-sync-worker/main.py --job db-openstation-siri-fm
```

The last two commands need the configured database. On first startup the SIRI job
may fail until the initial NeTEx inventory commits; its next scheduled run retries.
HTTP errors, unsupported XML, stale feeds and missing required inventory leave
existing publications untouched, with failure visible in collection health.

## Frontend

The Regionalatlas links to `/regionalatlas/bahn` (Bahnhöfe & Anlagen). The view
loads the two publications independently through same-origin Next.js routes
`/api/bahn/stations` and `/api/bahn/facilities`. The static inventory can be cached
for up to 300 seconds; facility requests use no additional cache. Both responses
retain source/receipt/expiry headers and are refreshed every 60 seconds while the
page is visible. Expired status stops appearing as available even when a refresh
fails. Missing statuses remain unknown; no local simulation or direct DB provider
request runs in the browser.

Search accepts station names, EVA numbers and DS100 codes. Each station has an
infrastructure list with object-type filtering, identifiers and explicit missing
coordinates. Optional Leaflet markers use own reported coordinates or explicit equipment-place
references, labelling that provenance in the popup and table. Linked facilities
replace generic equipment-place markers at the same location, so facility status
is visible without overlapping generic markers. Stored background tiles cover the Ried; Frankfurt/Mannheim object
positions may be shown without a complete background. Coordinate links open
OpenStreetMap. The frontend also resolves references from older publications during rolling
deployments; it does not depend on a fresh import to improve existing locations.

The `Sensor- und Datenstandorte im Bahnhofsumfeld` section reads the public raw
sensor inventory through `/api/bahn/sensors` (VPS `/api/v1/map/sensors`). It does
not use aggregated map coordinates. Sensor and infrastructure requests fail
independently. The inventory is refreshed every minute and candidates disappear
after five minutes without a fresh inventory, or when infrastructure expires.
A 100/500/1000 m radius compares unrounded great-circle distances to the nearest
reported infrastructure position; stations without positions get no spatial
matches. The UI reports the source object, distance and ambiguity when more than
one station qualifies. These are reversible spatial suggestions, not persisted
ownership assignments or causal sensor/train correlations. Public inventory also
contains data sites without readings; those are labelled as such. Stored readings
keep their individual timestamps; inventory freshness does not imply reading
freshness. Hidden records remain excluded by the existing public API.

RIS geography remains unavailable until subscription credentials and the exact
subscribed response schema have been verified. The public NeTEx reference joins
and sensor proximity flow do not require that optional service.

Frontend verification: `npm run test:security` includes the Bahn publication,
freshness, status and coordinate tests; `npm run build` checks the new routes and
page. The view can be tested against the collected VPS data via `BACKEND_API_URL`.
