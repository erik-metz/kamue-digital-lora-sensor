# VPS Telemetry Backend & TimescaleDB Infrastructure

This directory contains the cloud backend service and container configuration deployed on an **AWS EC2** instance to ingest, store, and serve LoRaWAN GPS tracker and sensor telemetry.

---

## Architecture Overview

```
 [LoRa Tracker]
       │ (LoRaWAN 868MHz)
       ▼
 [The Things Network (TTN)]
       │ (HTTP Webhook / REST POST)
       ▼
 ┌────────────────── AWS EC2 Host ──────────────────────────────┐
 │                                                               │
 │   ┌─────────────────┐           ┌────────────────────────┐    │
 │   │   backend-api   │◄─────────►│      timescaledb       │    │
 │   │ (FastAPI Port   │  psycopg3 │  (PostgreSQL 16 with   │    │
 │   │      8080)      │           │ TimescaleDB Hypertable)│    │
 │   └────────▲────────┘           └────────────────────────┘    │
 │            │ (Auto-update)                                    │
 │   ┌────────┴────────┐                                         │
 │   │   watchtower    │ ◄── Polls GHCR every 300s               │
 │   └─────────────────┘                                         │
 └───────────────────────────────────────────────────────────────┘
```

### Services (Docker Compose)
1. **`backend-api`**: High-performance asynchronous FastAPI service powered by `psycopg 3` with connection pooling (`psycopg-pool`). Automatically self-initializes the database schema on startup and auto-registers unknown incoming sensor IDs.
2. **`timescaledb`**: TimescaleDB running on PostgreSQL 16. Automatically partitions the `sensor_data` table into optimized time-based chunks (hypertables) for millisecond queries over millions of telemetry points.
3. **`watchtower`**: Lightweight daemon monitoring GitHub Container Registry (GHCR). When a new container image is pushed to `main`, Watchtower automatically pulls the new image and recreates the `backend_api` container with zero manual SSH intervention.

---

## Continuous Integration & Deployment (CI/CD)

The deployment pipeline is defined in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml):

1. **Code Validation**: Every push and pull request runs `ruff check www/vps/` to enforce code quality and styling.
2. **Container Build & Push**: On commits pushed to `main`:
   - Builds the Docker image from `www/vps/dockerfile`.
   - Authenticates to **GitHub Container Registry** (`ghcr.io`).
   - Pushes the image tagged as `ghcr.io/<repo-owner>/kamue-digital-lora-sensor:latest`.
3. **EC2 Continuous Deployment**:
   - The EC2 instance runs `watchtower`, which polls GHCR every 300 seconds (5 minutes).
   - Once a new image is detected, Watchtower gracefully restarts `backend-api` using the updated image.

---

## Environment Variables (`.env`)

Create a `.env` file in the same directory as `docker-compose.yml` on the EC2 host:

```bash
# PostgreSQL / TimescaleDB Credentials
POSTGRES_DB=mydatabase
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YourSuperSecurePassword123!

# Application Configuration
API_PORT=8080

# Bearer API Key required for ingesting data (LoRa tracker / TTN webhook)
API_KEY=open-ried-sens-live-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Database Schema & Auto-Initialization

The database structure is defined in [`schema.sql`](schema.sql):

- **`sensor_metadata`**: Stores sensor identity, friendly name, and installation coordinates (latitude/longitude).
- **`sensor_data`**: TimescaleDB hypertable storing timestamped measurements (`timestamp`, `sensor_id`, `value`, `unit`).
- **`idx_sensor_data_composite`**: Composite B-tree index on `(sensor_id, timestamp DESC)` for low-latency queries.

### How Schema Initialization Works
- **Self-Healing on Startup:** `backend-api` executes `schema.sql` automatically during its FastAPI lifespan startup (`main.py`). All statements use `IF NOT EXISTS`, making this safe and idempotent across container restarts.
- **Auto-Registration:** When sensor readings arrive via `/telemetry` or `/telemetry/batch` for an unregistered `sensor_id`, the API automatically creates a stub entry in `sensor_metadata` to satisfy the foreign key relation without dropping incoming packets.

---

## API Endpoints Reference

All routes are prefixed with `/api/v1`. Open Data GET endpoints are completely public with CORS enabled. Ingestion routes require `Authorization: Bearer <API_KEY>`, while Admin mutation routes require `Authorization: Bearer <ADMIN_API_KEY>`.

### Public Open Data Endpoints
| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/v1/sensors` | No | List all publicly active sensors (`is_hidden = FALSE`) |
| `GET` | `/api/v1/sensors/{sensor_id}` | No | Get metadata and status for a single public sensor |
| `GET` | `/api/v1/telemetry/latest` | No | Get the most recent telemetry reading for a given sensor |
| `GET` | `/api/v1/telemetry/raw` | No | Fetch raw historical points (`sensor_id`, `start_time`, `end_time`, `limit`) |
| `GET` | `/api/v1/telemetry/aggregates` | No | Fetch aggregated metrics (`avg`, `min`, `max`, `count`) grouped by `time_bucket` |
| `GET` | `/health` | No | Service health check |
| `GET` | `/docs` | No | Interactive Swagger UI API documentation |

### Ingestion Endpoints (LoRaWAN / TTN)
| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/v1/telemetry` | Bearer `API_KEY` | Ingest a single sensor reading |
| `POST` | `/api/v1/telemetry/batch` | Bearer `API_KEY` | Bulk ingest multiple sensor readings in a single transaction |

### Admin Endpoints (Open Ried Sens Next.js Webapp)
| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/v1/admin/sensors` | Bearer `ADMIN_API_KEY` | List all sensors (including hidden stations) |
| `POST` | `/api/v1/admin/sensors` | Bearer `ADMIN_API_KEY` | Register or create a new sensor station |
| `PUT` | `/api/v1/admin/sensors/{id}` | Bearer `ADMIN_API_KEY` | Update sensor metadata (name, coordinates, visibility) |
| `PATCH` | `/api/v1/admin/sensors/{id}/visibility` | Bearer `ADMIN_API_KEY` | Toggle sensor visibility (`is_hidden: true/false`) |
| `DELETE` | `/api/v1/admin/sensors/{id}` | Bearer `ADMIN_API_KEY` | Archive/hide or purge a sensor |
| `POST` | `/api/v1/sensors/register` | Bearer `ADMIN_API_KEY` | *Deprecated* legacy registration endpoint |

---

## EC2 Operation & Troubleshooting Commands

SSH into your EC2 instance and run these commands from your application directory (e.g. `~/app`):

### View Live Logs
```bash
# Follow live logs from backend API
docker compose logs -f backend-api

# Follow live database logs
docker compose logs -f timescaledb

# Check Watchtower update logs
docker compose logs -f watchtower
```

### Apply Schema Manually (Optional)
If you ever need to manually apply or verify `schema.sql` directly inside TimescaleDB:
```bash
# Inspect existing tables
docker compose exec timescaledb psql -U $POSTGRES_USER -d $POSTGRES_DB -c "\dt"

# Execute schema.sql from the host (if schema.sql is present on EC2)
docker compose exec -T timescaledb psql -U $POSTGRES_USER -d $POSTGRES_DB < schema.sql
```

### Restart / Update Services Manually
```bash
# Pull latest images and restart containers immediately
docker compose pull backend-api
docker compose up -d --force-recreate backend-api

# Clean up stale dangling images to save EC2 disk space
docker image prune -f
```
