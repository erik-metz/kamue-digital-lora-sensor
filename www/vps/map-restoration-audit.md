# Map restoration audit — 2026-09-29

All map values remain collector → database → backend → frontend. No bundled observations or browser-side provider requests were restored.

## Restored or repaired

- Weather classification: generic collector descriptions mentioned parking for every sensor. Parking-temperature detection now uses source entity identity, so real weather stations are no longer reassigned to soil. Regression test covers the production description.
- Sensor map: category-specific clusters keep weather, soil, water, air, parking, bikes, traffic and seismometers recognizable. Temperature colours, temperature pins, measurement labels at zoom 15/16, measurement names and observation times are restored. Old readings remain visibly stale.
- All selected sensor locations can be fitted into view, including peripheral seismometers. Map size follows its container.
- Flood gauge popups display water level and observation time from the existing environment collector.
- Traffic and closures: the map endpoint reads collected active traffic incidents from the database. Rows last seen more than two hours ago are omitted. Autobahn closures are shown; this does not establish coverage of municipal street closures.
- Railway crossings: regional OSM nodes are collected from the existing Geofabrik extract, persisted as `map/layers/crossings`, and exposed as a separate switch. No open/closed state is invented.
- Nature areas, agricultural areas, energy sites, public/customer WLAN locations, companies, schools, health, cultural and leisure places: OSM node/way features are persisted as map publications. Closed ways entirely inside the collection region provide polygons. Relations and boundary-crossing ways are not included, so these are partial OSM inventories, not comprehensive official registers. Energy production, crop species and WLAN service availability are not inferred.
- Vehicles retain backend-based motion smoothing, and stops retain stored departure dialogs.

## Still require authoritative source integrations

The audit found no active collected map publications for BORIS valuation zones, development plans, electoral district boundaries, broadband coverage or camera-derived road-condition grades. The former bundled demonstration data cannot be reinstated as current data. These layers remain explicitly unavailable. Schools, health facilities and cultural/tourism places now use a partial OSM inventory; emergency pharmacy duty and opening status remain unavailable and must never be inferred from those locations.

Crossing barrier status, live charger occupancy and measured energy generation still need provider feeds. OSM locations do not supply those live measurements. Basemap tiles are collected for the Ried region; panning to more distant seismometers may show locations beyond the collected tile coverage.

## Deployment

Deploy frontend normally. Pull and recreate `backend-api` and `registry-sync-worker` on the VPS. The registry worker detects the missing crossing publication and refreshes the OSM extract once, then resumes weekly reuse. Database schema changes are not required.
