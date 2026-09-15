-- 0. Ensure TimescaleDB Extension is enabled
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- 1. Metadata Table (Standard Postgres Table)
CREATE TABLE IF NOT EXISTS sensor_metadata (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    friendly_name VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent migrations for existing installations
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sensor_metadata' AND column_name = 'sensor_id'
    ) THEN
        ALTER TABLE sensor_metadata RENAME COLUMN sensor_id TO id;
    END IF;
END $$;

ALTER TABLE sensor_metadata ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE sensor_metadata ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE sensor_metadata ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE sensor_metadata ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Time-Series Metrics Table
CREATE TABLE IF NOT EXISTS sensor_data (
    timestamp TIMESTAMPTZ NOT NULL,
    sensor_id VARCHAR(64) NOT NULL REFERENCES sensor_metadata(id),
    value DOUBLE PRECISION NOT NULL,
    unit VARCHAR(32) NOT NULL
);

-- 3. Convert sensor_data into a TimescaleDB Hypertable partitioned by time
SELECT create_hypertable('sensor_data', 'timestamp', if_not_exists => TRUE);

-- Create an index to speed up lookups by specific sensor over time
-- Ensure index exists for fast range queries per sensor
CREATE INDEX IF NOT EXISTS idx_sensor_data_composite 
ON sensor_data (sensor_id, timestamp DESC);

-- A station can publish multiple independently queryable measurements.
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS metric VARCHAR(64) NOT NULL DEFAULT 'value';
CREATE INDEX IF NOT EXISTS idx_sensor_data_metric
ON sensor_data (sensor_id, metric, timestamp DESC);

-- Merge the legacy R498E RMS pseudo-station without losing its history.
-- Paired window timestamps identify historical PGV; unpaired samples retain
-- "value" because old raw waveform samples had no metric discriminator.
UPDATE sensor_data pgv SET metric = 'pgv'
WHERE pgv.sensor_id = 'shake-r498e' AND pgv.metric = 'value'
  AND EXISTS (
      SELECT 1 FROM sensor_data rms
      WHERE rms.sensor_id = 'shake-r498e-rms' AND rms.timestamp = pgv.timestamp
  );
UPDATE sensor_data SET sensor_id = 'shake-r498e', metric = 'rms'
WHERE sensor_id = 'shake-r498e-rms'
  AND EXISTS (SELECT 1 FROM sensor_metadata WHERE id = 'shake-r498e');
DELETE FROM sensor_metadata
WHERE id = 'shake-r498e-rms'
  AND EXISTS (SELECT 1 FROM sensor_metadata WHERE id = 'shake-r498e')
  AND NOT EXISTS (SELECT 1 FROM sensor_data WHERE sensor_id = 'shake-r498e-rms');

-- Published, versioned monthly export snapshots (UploadThing file keys stay private).
CREATE TABLE IF NOT EXISTS data_archives (
    month VARCHAR(7) PRIMARY KEY CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    generated_at TIMESTAMPTZ NOT NULL,
    is_complete BOOLEAN NOT NULL,
    reading_count BIGINT NOT NULL CHECK (reading_count >= 0),
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    station_ids TEXT[] NOT NULL,
    files JSONB NOT NULL
);

-- Smart City collector: scoped provenance/idempotency, without altering TTN/Shake.
CREATE TABLE IF NOT EXISTS smartcity_sources (
    sensor_id VARCHAR(64) PRIMARY KEY REFERENCES sensor_metadata(id) ON DELETE CASCADE,
    tenant VARCHAR(64) NOT NULL,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_name TEXT NOT NULL,
    last_fetched_at TIMESTAMPTZ NOT NULL,
    UNIQUE (tenant, entity_id)
);

-- Mapping identity cannot silently change units or meaning between polls.
CREATE TABLE IF NOT EXISTS smartcity_metrics (
    sensor_id VARCHAR(64) NOT NULL REFERENCES smartcity_sources(sensor_id) ON DELETE CASCADE,
    metric VARCHAR(64) NOT NULL,
    attribute TEXT NOT NULL,
    unit VARCHAR(32) NOT NULL,
    PRIMARY KEY (sensor_id, metric),
    UNIQUE (sensor_id, attribute)
);

CREATE TABLE IF NOT EXISTS smartcity_observations (
    sensor_id VARCHAR(64) NOT NULL,
    metric VARCHAR(64) NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    payload_hash TEXT NOT NULL,
    first_fetched_at TIMESTAMPTZ NOT NULL,
    last_fetched_at TIMESTAMPTZ NOT NULL,
    source_updated_at TIMESTAMPTZ,
    query_ids TEXT[] NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (sensor_id, metric, observed_at),
    FOREIGN KEY (sensor_id, metric) REFERENCES smartcity_metrics(sensor_id, metric) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS smartcity_revisions (
    sensor_id VARCHAR(64) NOT NULL,
    metric VARCHAR(64) NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    revision INTEGER NOT NULL,
    previous_value DOUBLE PRECISION NOT NULL,
    previous_payload_hash TEXT NOT NULL,
    revised_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (sensor_id, metric, observed_at, revision),
    FOREIGN KEY (sensor_id, metric, observed_at)
        REFERENCES smartcity_observations(sensor_id, metric, observed_at) ON DELETE CASCADE
);

-- Map summaries read a small current-value table, never the full hypertable.
CREATE TABLE IF NOT EXISTS sensor_latest (
    sensor_id VARCHAR(64) NOT NULL REFERENCES sensor_metadata(id) ON DELETE CASCADE,
    metric VARCHAR(64) NOT NULL,
    unit VARCHAR(32) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (sensor_id, metric, unit)
);

CREATE OR REPLACE FUNCTION maintain_sensor_latest() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND
        (OLD.sensor_id, OLD.metric, OLD.unit, OLD.timestamp) IS DISTINCT FROM
        (NEW.sensor_id, NEW.metric, NEW.unit, NEW.timestamp)) THEN
        DELETE FROM sensor_latest WHERE sensor_id = OLD.sensor_id AND metric = OLD.metric
            AND unit = OLD.unit AND timestamp = OLD.timestamp;
        IF FOUND THEN
            INSERT INTO sensor_latest (sensor_id, metric, unit, timestamp, value)
                SELECT sensor_id, metric, unit, timestamp, value FROM sensor_data
                WHERE sensor_id = OLD.sensor_id AND metric = OLD.metric AND unit = OLD.unit
                ORDER BY timestamp DESC LIMIT 1
            ON CONFLICT (sensor_id, metric, unit) DO UPDATE SET
                timestamp = EXCLUDED.timestamp, value = EXCLUDED.value
            WHERE sensor_latest.timestamp <= EXCLUDED.timestamp;
        END IF;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        INSERT INTO sensor_latest (sensor_id, metric, unit, timestamp, value)
            VALUES (NEW.sensor_id, NEW.metric, NEW.unit, NEW.timestamp, NEW.value)
        ON CONFLICT (sensor_id, metric, unit) DO UPDATE SET
            timestamp = EXCLUDED.timestamp, value = EXCLUDED.value
        WHERE sensor_latest.timestamp <= EXCLUDED.timestamp;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER sensor_latest_changed
AFTER INSERT OR UPDATE OR DELETE ON sensor_data
FOR EACH ROW EXECUTE FUNCTION maintain_sensor_latest();

CREATE TABLE IF NOT EXISTS telemetry_schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$
BEGIN
    PERFORM pg_advisory_xact_lock(734219, 2);
    IF NOT EXISTS (SELECT 1 FROM telemetry_schema_migrations WHERE name = 'sensor_latest_v1') THEN
        INSERT INTO sensor_latest (sensor_id, metric, unit, timestamp, value)
            SELECT DISTINCT ON (sensor_id, metric, unit) sensor_id, metric, unit, timestamp, value
            FROM sensor_data ORDER BY sensor_id, metric, unit, timestamp DESC
        ON CONFLICT (sensor_id, metric, unit) DO UPDATE SET
            timestamp = EXCLUDED.timestamp, value = EXCLUDED.value
        WHERE sensor_latest.timestamp < EXCLUDED.timestamp;
        INSERT INTO telemetry_schema_migrations (name) VALUES ('sensor_latest_v1');
    END IF;
END $$;

-- 4. Rail Infrastructure & Bahnübergänge
CREATE TABLE IF NOT EXISTS rail_crossings (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location_name VARCHAR(255) NOT NULL,
    street VARCHAR(255) NOT NULL,
    line VARCHAR(64) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    crossing_type VARCHAR(64) NOT NULL DEFAULT 'road_barrier',
    note TEXT,
    daily_closure_count_avg INT NOT NULL DEFAULT 48,
    avg_closure_duration_sec INT NOT NULL DEFAULT 120,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rail_crossing_events (
    id BIGSERIAL PRIMARY KEY,
    crossing_id VARCHAR(64) NOT NULL REFERENCES rail_crossings(id) ON DELETE CASCADE,
    train_line VARCHAR(64),
    destination VARCHAR(128),
    closed_at TIMESTAMPTZ NOT NULL,
    opened_at TIMESTAMPTZ,
    duration_sec INT,
    source VARCHAR(64) DEFAULT 'schedule_prediction'
);
