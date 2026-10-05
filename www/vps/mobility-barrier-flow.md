# Persisted mobility and barrier estimates

The registry sync worker is the single shared predictor. Every ten seconds it
interpolates collected GTFS/ZAKB trajectories and stores positions. If the
canonical measurement core is installed, `store_position` writes latitude,
longitude, speed and delay through `write_movement_position`, even without shadow
triggers. Existing enabled shadow triggers remain the writer on shadow deployments.
Values are in `entities`, `measurement_definitions`, `readings`; `latest_readings`
is their current-value cache. The legacy position compatibility tables remain.

The same tick estimates barrier states from the persisted train trajectories
used for these positions. OSM railway nodes qualify only with a documented
`crossing:barrier=yes/full/half/double_half`. Nearby (at most 30 m) nodes with the
same name and barrier type represent one site, preserving their OSM member IDs.
Unbarriered and undocumented crossings are excluded. Distinct nearby sites are
clustered at smaller map scales and can be expanded.

The train shape must either be supplied by the provider or routed on connected
OSM passenger railway edges, and pass within 25 m of a site. Missing provider
shapes use the regional OSM extract: station endpoints must be within 250 m of
the network and the connected path must not exceed 1.8 times the direct distance
plus 500 m. Sidings are excluded. The same routed segments drive vehicle GPS
interpolation and barrier passages. Unsupported segments, stop-to-stop chords,
bus trajectories and waste tours never drive barrier states.
The estimate uses the projected passage time plus collected delay: warning from
120 seconds before passage, closed from 60 seconds before until 30 seconds after.
Overlapping train windows keep the barrier closed. Fresh, uncancelled stored
train schedules within two hours either side of the tick supply the model inputs,
so a site can be estimated open between services. Missing applicable route input
produces a NULL/missing reading, not an open state. Freight and other unscheduled
services, actual barrier control lead times and train lengths are not fully covered.
These are visibly labelled estimates, never operational clearance information.

Each site has a canonical `crossing:osm-node-…` entity. `crossing_state` is a state
measurement with basis `model`: 0=open, 1=closing soon, 2=closed. Every ten-second
sample records model version, source payload checksums, nearby train inputs and a
30-second validity deadline. Unknown samples remain in history as missing values.
No separate crossing-value table is introduced. The predictor requires the
existing explicit measurement-core installation; it does not migrate the schema
at worker startup. Without that core, vehicle compatibility output still works
and the API reports `crossings_available=false`.

`GET /api/v1/movements/stream` sends one SSE snapshot every ten seconds, containing
vehicles and barrier estimates read from the database. The Next.js stream proxy
passes it through without caching, and nginx disables buffering for this endpoint.
The browser reconnects automatically and falls back to the existing batch poll
when the stream fails/stalls. Vehicle animation only interpolates received points.
Expired vehicles disappear; expired barriers become unknown.

Clicking a barrier, train, bus or waste-tour marker selects its canonical entity
in the shared chart. `GET /api/v1/movements/telemetry?entity_id=…` reads its current
scalar values and 24-hour history. Barrier history retains both sides of changes
and gaps as a step chart, without fractional averages; vehicle metrics use
five-minute averages, including speed, delay and coordinates. Observed values
win over predictions at the same timestamp. The old browser-generated barrier
telemetry fallback is removed. Current model samples refresh every ten seconds;
selected expired entities retain accessible history but have no current reading.

Deployment: update backend API, registry sync worker, frontend and nginx together.
No new schema migration is needed on an existing canonical-core installation.
The OSM collector refreshes an older crossing inventory once (inventory version 3),
then resumes its normal cadence. Check `/api/v1/movements/latest`, the SSE endpoint,
`crossings_available`, and the canonical telemetry endpoint after deployment.
CI/GHCR publication alone does not demonstrate that the VPS/frontend have restarted.
