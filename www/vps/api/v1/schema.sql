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

-- 5. Moving Trains Positioning (TimescaleDB Hypertable)
CREATE TABLE IF NOT EXISTS train_positions (
    timestamp TIMESTAMPTZ NOT NULL,
    train_id VARCHAR(64) NOT NULL,
    line VARCHAR(32) NOT NULL,
    origin VARCHAR(128),
    destination VARCHAR(128) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed_kmh DOUBLE PRECISION NOT NULL,
    status VARCHAR(32) NOT NULL, -- 'moving' | 'stopped'
    station_id VARCHAR(64)       -- if stopped
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        PERFORM create_hypertable('train_positions', 'timestamp', if_not_exists => TRUE);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_train_positions_id_time ON train_positions (train_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_train_positions_time ON train_positions (timestamp DESC);

-- 6. Register the 4 Active Bahnübergänge in sensor_metadata for telemetry history
INSERT INTO sensor_metadata (id, friendly_name, latitude, longitude, is_hidden, description)
VALUES
    ('bu-buerstadt-mainstr', 'BÜ Mainstraße (Bürstadt)', 49.64600, 8.45398, FALSE, 'Nibelungenbahn km 9.8 · RBÜT Halbschrankenanlage'),
    ('bu-buerstadt-waldgarten', 'BÜ Waldgartenstraße (Bürstadt)', 49.64574, 8.45819, FALSE, 'Nibelungenbahn km 10.18 · Vollbeschrankter Fußgängerüberweg'),
    ('bu-biblis-kirchstr', 'BÜ Kirchstraße (Biblis)', 49.68207, 8.44415, FALSE, 'Riedbahn km 27.20 · Modernisierte Schrankenanlage Gemeindesee'),
    ('bu-hofheim-bibliser-weg', 'BÜ Bibliser Weg (Hofheim)', 49.66258, 8.41341, FALSE, 'Worms–Biblis km 6.09 · RBÜT Halbschranken L3411')
ON CONFLICT (id) DO UPDATE SET
    friendly_name = EXCLUDED.friendly_name,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    description = EXCLUDED.description,
    is_hidden = FALSE;

-- 7. ZAKB Waste Collection & Refuse Fleet Telemetry
CREATE TABLE IF NOT EXISTS waste_facilities (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    facility_type VARCHAR(64) NOT NULL DEFAULT 'recycling_yard',
    municipality VARCHAR(64) NOT NULL,
    address VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accepted_fractions TEXT[] NOT NULL DEFAULT ARRAY['restmuell', 'biomuell', 'papier', 'gelber_sack', 'sperrmuell', 'schadstoffe'],
    opening_hours JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS waste_truck_fleet (
    id VARCHAR(64) PRIMARY KEY,
    license_plate VARCHAR(32) NOT NULL,
    vehicle_model VARCHAR(128) NOT NULL,
    assigned_fraction VARCHAR(32) NOT NULL,
    assigned_municipality VARCHAR(64) NOT NULL,
    capacity_m3 DOUBLE PRECISION DEFAULT 22.0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS waste_collection_calendar (
    id BIGSERIAL PRIMARY KEY,
    municipality VARCHAR(64) NOT NULL,
    district VARCHAR(64),
    street_name VARCHAR(255) NOT NULL,
    fraction VARCHAR(32) NOT NULL,
    collection_date DATE NOT NULL,
    expected_time_start TIME,
    expected_time_end TIME,
    tour_code VARCHAR(32),
    source VARCHAR(64) DEFAULT 'zakb_abfuhrkalender',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_waste_calendar_pickup UNIQUE (municipality, street_name, fraction, collection_date)
);
CREATE INDEX IF NOT EXISTS idx_waste_calendar_date ON waste_collection_calendar (collection_date);
CREATE INDEX IF NOT EXISTS idx_waste_calendar_street ON waste_collection_calendar (municipality, street_name);

CREATE TABLE IF NOT EXISTS waste_truck_positions (
    timestamp TIMESTAMPTZ NOT NULL,
    truck_id VARCHAR(64) NOT NULL REFERENCES waste_truck_fleet(id) ON DELETE CASCADE,
    tour_code VARCHAR(32) NOT NULL,
    fraction VARCHAR(32) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION,
    speed_kmh DOUBLE PRECISION NOT NULL,
    status VARCHAR(32) NOT NULL, -- 'collecting' | 'bin_emptying' | 'transit' | 'depot'
    current_street VARCHAR(255),
    next_street VARCHAR(255),
    load_percent INT,
    empty_countdown_sec INT,
    position_basis VARCHAR(64) NOT NULL DEFAULT 'model_prediction' -- 'model_prediction' | 'observed_gps' | 'crowdsourced'
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        PERFORM create_hypertable('waste_truck_positions', 'timestamp', if_not_exists => TRUE);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_waste_truck_positions_id_time ON waste_truck_positions (truck_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_waste_truck_positions_time ON waste_truck_positions (timestamp DESC);

CREATE TABLE IF NOT EXISTS waste_collection_events (
    id BIGSERIAL PRIMARY KEY,
    truck_id VARCHAR(64) NOT NULL REFERENCES waste_truck_fleet(id) ON DELETE CASCADE,
    street_name VARCHAR(255) NOT NULL,
    municipality VARCHAR(64) NOT NULL,
    fraction VARCHAR(32) NOT NULL,
    dwell_started_at TIMESTAMPTZ NOT NULL,
    dwell_ended_at TIMESTAMPTZ,
    dwell_duration_sec INT,
    status VARCHAR(32) DEFAULT 'completed'
);
CREATE INDEX IF NOT EXISTS idx_waste_events_truck ON waste_collection_events (truck_id, dwell_started_at DESC);

-- Seed ZAKB Facilities
INSERT INTO waste_facilities (id, name, facility_type, municipality, address, latitude, longitude)
VALUES
    ('zakb-huettenfeld', 'ZAKB Energiepark Hüttenfeld (Zentrale & Fuhrpark)', 'headquarters_depot', 'Lampertheim', 'Heidenfahrt 1, 68623 Lampertheim-Hüttenfeld', 49.5962, 8.5838),
    ('zakb-buerstadt', 'ZAKB Wertstoffhof Bürstadt & Umladestation', 'recycling_yard', 'Bürstadt', 'Zur Biogasanlage 1, 68642 Bürstadt', 49.6382, 8.4485),
    ('zakb-lampertheim', 'ZAKB Wertstoffhof Lampertheim', 'recycling_yard', 'Lampertheim', 'Klärwerkstraße 6–8, 68623 Lampertheim', 49.6018, 8.4524),
    ('zakb-biblis', 'ZAKB Wertstoffhof Biblis', 'recycling_yard', 'Biblis', 'Am Werrtor, 68647 Biblis', 49.6912, 8.4420)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude;

-- Seed ZAKB Fleet Vehicles
INSERT INTO waste_truck_fleet (id, license_plate, vehicle_model, assigned_fraction, assigned_municipality, capacity_m3)
VALUES
    ('tour-bst-restmuell', 'HP-ZK 102', 'Mercedes-Benz Econic 2630 (Faun Rotopress)', 'restmuell', 'Bürstadt', 22.0),
    ('tour-la-biomuell', 'HP-ZK 214', 'MAN TGM 26.320 (Zöller Medium X4)', 'biomuell', 'Lampertheim', 21.5),
    ('tour-hof-gelbersack', 'HP-ZK 308', 'Scania L280 (Variopress 524)', 'gelber_sack', 'Hofheim (Ried)', 24.0),
    ('tour-bib-papier', 'HP-ZK 419', 'Volvo FE Electric (Faun Variopress)', 'papier', 'Biblis', 22.5),
    ('tour-ried-umweltmobil', 'HP-UM 1', 'Sonder-LKW Schadstofferfassung Kreis Bergstraße', 'umweltmobil', 'Bürstadt', 16.0)
ON CONFLICT (id) DO UPDATE SET
    license_plate = EXCLUDED.license_plate,
    vehicle_model = EXCLUDED.vehicle_model,
    assigned_fraction = EXCLUDED.assigned_fraction,
    assigned_municipality = EXCLUDED.assigned_municipality;

