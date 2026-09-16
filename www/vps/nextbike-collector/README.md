# Nextbike collector

Fetches the official Nextbike live feed, validates complete city snapshots, and transactionally stores station availability, bike inventory and inferred station changes.

Use `NEXTBIKE_CITY_IDS=559` (default) or comma-separated positive IDs; collecting the whole feed requires the explicit value `all`. `NEXTBIKE_POLL_SECONDS` defaults to 60, `NEXTBIKE_STATE_DIR` to `/data`. `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` configure PostgreSQL.

```sh
python main.py --once
python main.py --dry-run --input nextbike-live.json
python main.py --healthcheck
```

Offline input is the original provider envelope with `countries`, `cities` and `places`. Invalid or incomplete snapshots fail without writes. A valid city with an empty `places` array is supported.

See [collector maintenance](../collectors.md) for structure, status fields, retention/freshness rules, deployment order and tests. Bike movements are inferred from observations; they are not confirmed customer trips.
