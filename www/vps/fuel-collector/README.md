# Regional fuel collector

One Tankerkönig `list.php?type=all` request every 300 seconds for a 25 km circle
around 49.62, 8.46. No national crawling or per-browser provider calls.
Prices are integer thousandths of EUR/litre, missing prices are null. A validated
complete snapshot replaces the previous snapshot atomically; failures preserve it.
The current snapshot also feeds shared `sensor_metadata`/`sensor_data` telemetry
(station ID `fuel-<provider UUID>`, metrics `fuel_e5`, `fuel_e10`, `fuel_diesel`,
unit `€/l`). Where installed, shadow triggers retain canonical core compatibility.
Price changes and unchanged-price heartbeats every 15 minutes are stored atomically
with the snapshot; replayed snapshots do not write telemetry. Missing prices are
not written as zero. Existing admin metadata survives. History starts at deployment;
no earlier prices are invented. Acquisition time is explicitly
not a provider price-change timestamp. Data expires for comparisons/opening filters
after 15 minutes; old values remain labelled stale.

Set `TANKERKOENIG_API_KEY` in the VPS `.env` (never commit credentials).
Optional `FUEL_LATITUDE`, `FUEL_LONGITUDE`, `FUEL_RADIUS_KM` (<=25) and
`FUEL_POLL_SECONDS` (>=60). Run only one instance per key. DB configuration and
`FUEL_STATE_DIR` follow the other collectors. HTTP errors and logging redact URLs.

Apply `api/v1/migrations/20261007_fuel.sql` first (API startup also applies it),
then pull/recreate backend-api and fuel-collector in the existing Compose project.
Do not just restart an existing container after changing its environment.

```sh
python main.py --once
python main.py --dry-run
python main.py --dry-run --input snapshot.json
python main.py --healthcheck
PYTHONPATH=www/vps/fuel-collector python -m pytest www/vps/fuel-collector/tests
```

Public backend `/api/v1/fuel`, frontend proxy `/api/fuel`, map mobility layer
“Tankstellen & Spritpreise”. Sorting uses the selected fuel or straight-line distance
to the current map center. Cheapest excludes closed/missing/stale prices. No routing
or verified opening hours are implied.

Source: [Tankerkönig / MTS-K](https://creativecommons.tankerkoenig.de/),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
