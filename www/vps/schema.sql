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