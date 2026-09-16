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
