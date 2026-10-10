# Traffic collector

Fetches warnings, roadworks and closures for the configured Autobahnen. A cycle writes only after every required endpoint succeeds and the complete snapshot validates.

`TRAFFIC_ROADS` accepts CSV (`A67,A5,A6`, default) or a JSON array. `TRAFFIC_POLL_SECONDS` defaults to 180, `TRAFFIC_STATE_DIR` to `/data`. `AUTOBAHN_API_BASE` must be an HTTPS base URL. PostgreSQL uses the standard `DB_*` variables.

```sh
python main.py --once
python main.py --dry-run
python main.py --dry-run --input traffic.json
python main.py --healthcheck
```

Offline input groups the unchanged provider responses by road and endpoint:

```json
{"A67":{"warning":{"warning":[]},"roadworks":{"roadworks":[]},"closure":{"closure":[]}}}
```

Set `TRAFFIC_ROADS=A67` for that fixture. Missing roads/endpoints fail validation. A successful empty response is distinct from an unavailable source. Resolution is scoped to the configured roads/source and preserves the six-minute grace period.

See [collector maintenance](../collectors.md) for common structure, provenance, health, migration and verification details.

## Event semantics (migration 20261009)

Deploy the API first: its additive `20261009_traffic_events.sql` migration runs
at startup, and the collector refuses to write until that version is present.
Compose already waits for the API health check. Deploy the matching frontend
with the API, because unknown delays are now JSON `null` and corridors can be
`unknown`.

`start_time` / `end_time` remain first observation and inferred disappearance.
Provider phase dates are `provider_start_at` / `provider_end_at`; the end of the
overall construction project is the separate date `overall_end_date`.
`is_active` means still reported by the source. The `traffic_events` view derives
`planned`, `active`, `ended`, or `resolved` at read time; plans never contribute
to current corridor snapshots or the flow model. An undated future item stays
planned until the provider updates it. Reopening preserves the first observation.
Provider phase ends are scheduled estimates, not confirmation of actual completion.

`closure_kind` distinguishes `full`, `entry_exit`, `restriction`, `unknown`, and
`none`. Work length is distinct from jam length. Direction labels and source IDs
are retained. Coordinates and intersecting GeoJSON segments define regional
membership; a destination in a description cannot override distant coordinates.

All required Autobahn endpoints must succeed before reconciliation. Hessen
omissions are reconciled only when both optional datasets were parsed completely.
`traffic_source_checks` records successful complete snapshots, including empty
ones. Event freshness is 10 minutes for Autobahn and 20 minutes for Hessen;
corridor coverage expires after 10 minutes. Unknown delay is not written as an
observed zero into the measurement core. Traffic-derived flow fallback remains
an explicitly labelled model, not a measurement.

API: `/traffic/incidents?event_status=active|planned|all&category=warning|roadworks|closure&planned_days=7`.
Plans beyond the selected horizon are omitted; undated plans remain visible.
GeoJSON includes current events and plans in the next seven days, with stale
records labelled and omitted after two hours. Municipal closure filters retain
their independent existing lifecycle. The legacy `/traffic/sync` upserts by
default; omissions require explicit `completed_scopes: [{"source":"...","roads":["A67"]}]`.
An empty unscoped request cannot resolve other sources' events.
