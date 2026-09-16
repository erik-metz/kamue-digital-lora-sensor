# Raspberry Shake collector

Streams CAPS/MiniSEED records independently for configured stations, discovers their real vertical channels through FDSN, and calculates fixed source-time `pgv` and `rms` windows. Units remain counts; no physical-velocity calibration is implied. Optional decimated waveform readings use the `waveform` metric under the same station ID.

The service uses separate source, normalization, storage, durable-buffer and health modules. Pending windows survive restart in the persistent `/data` volume. API and direct database writes use transactionally committed replay receipts.

See [collector maintenance](../collectors.md#shake-streaming) for all settings, source-time and late-sample behavior, retry/durability boundaries, and shutdown behavior. Apply the updated API schema before starting this version.

```sh
pip install -r requirements.txt
python main.py
python main.py --duration 60
python main.py --healthcheck
SHAKE_STATIONS=R498E python main.py --dry-run --input samples.json
```

Offline input is an array of `[unix_seconds, counts]` pairs and writes nothing. Use one station for replay. Live capture requires ObsPy; the production image installs it. Run tests using pytest with the collector directory on `PYTHONPATH`, or use the repository's `www/vps/test-collectors.sh` runner.

Defaults include the ten configured stations (`R498E,R82E7,R79F9,RB012,R021A,R5DFB,RC017,R2852,RB8D1,SC342`), a five-second window, and direct database ingestion. API mode requires distinct `API_KEY` and `ADMIN_API_KEY`; registration preserves admin metadata.
