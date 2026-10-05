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

The explicit subset is Frankfurt (Main) Hbf, Groß Rohrheim, Biblis, Bobstadt,
Bürstadt, Lampertheim, Hofheim (Ried), and Mannheim Hbf. This is an initial station
inventory, not complete coverage of every stop between Frankfurt and Mannheim.
Edit `station_names` or supply `eva_numbers` in `sources.json` to change coverage.
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
lift. EquipmentPlace references are retained for later location joins. Provider
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
remapping the subscribed API schema. FaSta publishes
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
