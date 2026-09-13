# Raspberry Shake Live Telemetry Collector

Daemon container service that streams real-time seismic waveform telemetry from a Raspberry Shake Earth monitor (e.g. station **`AM.R498E.00.EHZ`** located in Bürstadt / Bobstadt) and pushes windowed vibration intensity metrics into the Open Ried Sens TimescaleDB backend.

---

## Features

- **Real-Time Streaming**: Directly connects to the gempa **CAPS WebSocket protocol** (`wss://data.raspberryshake.org/caps/`), matching the live behavior of [Raspberry Shake DataView](https://dataview.raspberryshake.org/#/AM/R498E/00/EHZ?streaming=on).
- **MiniSEED Decoding**: Parses standard MiniSEED seismic records at 100 Hz.
- **Windowed Metrics**: Computes **Peak Ground Velocity (PGV / Peak Vibration)** and **RMS Tremor Noise Floor** over rolling time windows (default: 5 seconds) to prevent database bloat while maintaining responsive open data dashboards.
- **Flexible Ingestion**: Supports pushing to `backend-api` (`/api/v1/telemetry/batch`) or direct insertion into `timescaledb`.
- **Automatic Station Registration**: Automatically registers the sensor metadata (name, coordinates, description) in `sensor_metadata` on startup.
- **Resilience**: Asynchronous event loop with automatic reconnection and exponential backoff upon network dropouts.

---

## Configuration (`.env`)

| Variable                | Default                                                      | Description                                                                 |
| :---------------------- | :----------------------------------------------------------- | :-------------------------------------------------------------------------- |
| `SHAKE_NETWORK`         | `AM`                                                         | Raspberry Shake network code                                                |
| `SHAKE_STATION`         | `R498E`                                                      | Station identifier                                                          |
| `SHAKE_LOCATION`        | `00`                                                         | Location identifier                                                         |
| `SHAKE_CHANNEL`         | `EHZ`                                                        | Channel code (EHZ: Short period vertical geophone)                          |
| `SHAKE_WS_URL`          | `wss://swarm:ujHsN9qbYiTAx69H@data.raspberryshake.org/caps/` | CAPS WebSocket endpoint                                                     |
| `SENSOR_ID`             | `shake-r498e`                                                | Unique identifier stored in `sensor_metadata`                               |
| `SENSOR_NAME`           | `Station 5: Bürstadt Seismometer (Raspberry Shake R498E)`    | Friendly station name                                                       |
| `LATITUDE`              | `49.65766`                                                   | Station latitude (Bürstadt / Bobstadt)                                      |
| `LONGITUDE`             | `8.43426`                                                    | Station longitude (Bürstadt / Bobstadt)                                     |
| `INGEST_MODE`           | `api`                                                        | Ingestion mode: `api` (via backend-api) or `direct_db` (TimescaleDB direct) |
| `API_URL`               | `http://backend-api:8080/api/v1`                             | Backend API URL (for Docker internal network)                               |
| `API_KEY`               | -                                                            | Ingestion bearer token                                                      |
| `ADMIN_API_KEY`         | -                                                            | Admin token to register/update sensor metadata                              |
| `SAMPLING_INTERVAL_SEC` | `5.0`                                                        | Window interval in seconds for PGV & RMS calculations                       |
| `STORE_RAW_WAVEFORM`    | `false`                                                      | When true, downsampled raw waveform samples are also saved                  |
| `RAW_DECIMATION_FACTOR` | `10`                                                         | Decimation factor for raw waveforms (100 Hz / 10 = 10 Hz)                   |

---

## Standalone Execution (Development)

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run connectivity test
python test_connection.py

# 3. Start collector
python main.py
```
