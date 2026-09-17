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

-- 6. Seed the 4 Active Bahnübergänge in rail_crossings
INSERT INTO rail_crossings (id, name, location_name, street, line, latitude, longitude, crossing_type, note, daily_closure_count_avg, avg_closure_duration_sec)
VALUES
    ('bu-buerstadt-mainstr', 'BÜ Mainstraße', 'Bürstadt Mainstraße', 'Mainstraße', 'Nibelungenbahn', 49.64600, 8.45398, 'road_barrier', 'Modernisierte RBÜT Halbschranken mit Lichtzeichen (km 9.8)', 48, 135),
    ('bu-buerstadt-waldgarten', 'BÜ Waldgartenstraße', 'Bürstadt Waldgarten-/Industriestr.', 'Waldgartenstraße / Industriestraße', 'Nibelungenbahn', 49.64574, 8.45819, 'pedestrian_barrier', 'Vollbeschrankter Fußgänger-/Reisendenüberweg (km 10.18)', 48, 110),
    ('bu-biblis-kirchstr', 'BÜ Kirchstraße', 'Biblis Kirchstraße (Gemeindesee)', 'Kirchstraße', 'Riedbahn', 49.68207, 8.44415, 'road_barrier', 'Modernisierte Halbschrankenanlage mit Radar-/Kameraüberwachung (km 27.2)', 72, 155),
    ('bu-hofheim-bibliser-weg', 'BÜ Bibliser Weg', 'Hofheim (Ried) Bibliser Weg', 'Bibliser Weg / L3411', 'Nibelungenbahn', 49.66258, 8.41341, 'road_barrier', 'Modernisiert 2019 mit RBÜT Halbschranken + Lichtzeichen (km 6.09)', 36, 120)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    location_name = EXCLUDED.location_name,
    street = EXCLUDED.street,
    line = EXCLUDED.line,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    crossing_type = EXCLUDED.crossing_type,
    note = EXCLUDED.note,
    daily_closure_count_avg = EXCLUDED.daily_closure_count_avg,
    avg_closure_duration_sec = EXCLUDED.avg_closure_duration_sec;

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

-- 8. Bus Infrastructure & VRN GTFS-RT Telemetry
CREATE TABLE IF NOT EXISTS bus_stops (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    municipality VARCHAR(64) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    lines TEXT[] NOT NULL,
    is_school_stop BOOLEAN NOT NULL DEFAULT FALSE,
    nearby_school_name VARCHAR(255),
    is_train_hub BOOLEAN NOT NULL DEFAULT FALSE,
    direction VARCHAR(64),
    direction_label VARCHAR(128),
    platforms TEXT[] DEFAULT ARRAY['Steig 1'],
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bus_stops ADD COLUMN IF NOT EXISTS direction VARCHAR(64);
ALTER TABLE bus_stops ADD COLUMN IF NOT EXISTS direction_label VARCHAR(128);

CREATE TABLE IF NOT EXISTS bus_lines (
    id VARCHAR(64) PRIMARY KEY,
    line_number VARCHAR(32) NOT NULL,
    operator VARCHAR(128) NOT NULL,
    route_name VARCHAR(255) NOT NULL,
    color VARCHAR(16) DEFAULT '#0284c7',
    is_school_line BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bus_positions (
    timestamp TIMESTAMPTZ NOT NULL,
    vehicle_id VARCHAR(64) NOT NULL,
    trip_id VARCHAR(64),
    line VARCHAR(32) NOT NULL,
    origin VARCHAR(128),
    destination VARCHAR(128) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION,
    speed_kmh DOUBLE PRECISION NOT NULL,
    status VARCHAR(32) NOT NULL, -- 'moving' | 'stopped'
    stop_id VARCHAR(64),
    is_school_bus BOOLEAN NOT NULL DEFAULT FALSE,
    delay_sec INT DEFAULT 0,
    position_basis VARCHAR(64) NOT NULL DEFAULT 'model_prediction' -- 'model_prediction' | 'vrn_gtfs_rt'
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        PERFORM create_hypertable('bus_positions', 'timestamp', if_not_exists => TRUE);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_bus_positions_id_time ON bus_positions (vehicle_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bus_positions_time ON bus_positions (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bus_positions_line ON bus_positions (line, timestamp DESC);

-- Seed Ried Bus Lines
INSERT INTO bus_lines (id, line_number, operator, route_name, color, is_school_line)
VALUES
    ('vrn-641', '641', 'VRN / Verkehrsgesellschaft Gersprenztal (VGG)', 'Bürstadt Bahnhof – Bobstadt – Lampertheim Bahnhof', '#0284c7', FALSE),
    ('vrn-642', '642', 'VRN / Busverkehr Rhein-Neckar (BRN)', 'Worms Hbf – Hofheim – Bürstadt EKS', '#0284c7', FALSE),
    ('vrn-644', '644', 'VRN / BRN', 'Worms Hbf – Biblis Bahnhof', '#0284c7', FALSE),
    ('vrn-652', '652', 'VRN / Schülerverkehr Kreis Bergstraße', 'Bobstadt – Bürstadt (EKS) – Lampertheim Schulzentrum', '#f59e0b', TRUE)
ON CONFLICT (id) DO UPDATE SET
    line_number = EXCLUDED.line_number,
    operator = EXCLUDED.operator,
    route_name = EXCLUDED.route_name,
    color = EXCLUDED.color,
    is_school_line = EXCLUDED.is_school_line;

-- Seed Ried Bus Stops (Directional platforms for both sides of the street across all municipalities)
INSERT INTO bus_stops (id, name, municipality, latitude, longitude, lines, is_school_stop, nearby_school_name, is_train_hub, direction, direction_label, platforms)
VALUES
    ('stop-bst-bahnhof-steig1', 'Bürstadt Bahnhof (ZOB)', 'Bürstadt', 49.64548, 8.45835, ARRAY['641', '642', '643', '652'], FALSE, NULL, TRUE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Bussteig 1 (Richtung Lampertheim / Bobstadt)']),
    ('stop-bst-bahnhof-steig2', 'Bürstadt Bahnhof (ZOB)', 'Bürstadt', 49.64534, 8.45819, ARRAY['641', '642', '643', '652'], FALSE, NULL, TRUE, 'Worms', 'Richtung Worms Hbf', ARRAY['Bussteig 2 (Richtung Worms / Hofheim)']),
    ('stop-bst-bahnhof-steig3', 'Bürstadt Bahnhof (ZOB)', 'Bürstadt', 49.64555, 8.4581, ARRAY['641', '642', '643', '652'], FALSE, NULL, TRUE, 'Bürstadt', 'Richtung Bürstadt EKS', ARRAY['Bussteig 3 (Richtung EKS / Gartenstadt)']),
    ('stop-bst-marktplatz-ost', 'Bürstadt Marktplatz / Historisches Rathaus', 'Bürstadt', 49.64146, 8.45472, ARRAY['641', '642', '652'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof / EKS', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bst-marktplatz-west', 'Bürstadt Marktplatz / Historisches Rathaus', 'Bürstadt', 49.64134, 8.45448, ARRAY['641', '642', '652'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms / Lampertheim', ARRAY['Steig 2 (Richtung Worms / Lampertheim)']),
    ('stop-bst-eks-ankunft', 'Bürstadt Erich-Kästner-Schule', 'Bürstadt', 49.64838, 8.46152, ARRAY['642', '652'], TRUE, 'Erich-Kästner-Schule (Integrierte Gesamtschule)', FALSE, 'Lampertheim', 'Richtung Lampertheim Schulzentrum', ARRAY['Schulbussteig 1 (Richtung Lampertheim)']),
    ('stop-bst-eks-abfahrt', 'Bürstadt Erich-Kästner-Schule', 'Bürstadt', 49.64822, 8.46128, ARRAY['642', '652'], TRUE, 'Erich-Kästner-Schule (Integrierte Gesamtschule)', FALSE, 'Worms', 'Richtung Bürstadt Bhf / Worms Hbf', ARRAY['Schulbussteig 2 (Richtung Bahnhof / Worms)']),
    ('stop-bst-schillerschule-nord', 'Bürstadt Schillerschule / Boxheimerhofstr.', 'Bürstadt', 49.64968, 8.46172, ARRAY['641', '652'], TRUE, 'Schillerschule Grundschule', FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bst-schillerschule-sued', 'Bürstadt Schillerschule / Boxheimerhofstr.', 'Bürstadt', 49.64952, 8.46148, ARRAY['641', '652'], TRUE, 'Schillerschule Grundschule', FALSE, 'Lampertheim', 'Richtung Boxheimerhof / Lampertheim', ARRAY['Steig 2 (Richtung Lampertheim)']),
    ('stop-bst-boxheimerhof-nord', 'Bürstadt Boxheimerhof', 'Bürstadt', 49.62968, 8.47962, ARRAY['641', '652'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt Bhf)']),
    ('stop-bst-boxheimerhof-sued', 'Bürstadt Boxheimerhof', 'Bürstadt', 49.62952, 8.47938, ARRAY['641', '652'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 2 (Richtung Lampertheim Bhf)']),
    ('stop-bst-sonneneck-nord', 'Bürstadt Sonneneck / Mainstraße Süd', 'Bürstadt', 49.64328, 8.45162, ARRAY['642'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof / EKS', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bst-sonneneck-sued', 'Bürstadt Sonneneck / Mainstraße Süd', 'Bürstadt', 49.64312, 8.45138, ARRAY['642'], FALSE, NULL, FALSE, 'Worms', 'Richtung Hofheim / Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-bst-nibelungenstr-ost', 'Bürstadt Nibelungenstraße (B47)', 'Bürstadt', 49.64156, 8.45312, ARRAY['642', '643'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bst-nibelungenstr-west', 'Bürstadt Nibelungenstraße (B47)', 'Bürstadt', 49.64144, 8.45288, ARRAY['642', '643'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-bst-wilhelminenstr-nord', 'Bürstadt Wilhelminenstraße', 'Bürstadt', 49.64408, 8.45562, ARRAY['641', '652'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bst-wilhelminenstr-sued', 'Bürstadt Wilhelminenstraße', 'Bürstadt', 49.64392, 8.45538, ARRAY['641', '652'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 2 (Richtung Lampertheim)']),
    ('stop-bst-wasserwerk-nord', 'Bürstadt Wasserwerk', 'Bürstadt', 49.63908, 8.45912, ARRAY['642'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bst-wasserwerk-sued', 'Bürstadt Wasserwerk', 'Bürstadt', 49.63892, 8.45888, ARRAY['642'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-bst-industriestr-ost', 'Bürstadt Industriestraße / KAMÜ Kulturzentrum', 'Bürstadt', 49.64578, 8.45832, ARRAY['641', '643'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bst-industriestr-west', 'Bürstadt Industriestraße / KAMÜ Kulturzentrum', 'Bürstadt', 49.64562, 8.45808, ARRAY['641', '643'], FALSE, NULL, FALSE, 'Bobstadt', 'Richtung Bobstadt', ARRAY['Steig 2 (Richtung Bobstadt)']),
    ('stop-bst-altenheim-nord', 'Bürstadt St. Elisabeth / Seniorenzentrum', 'Bürstadt', 49.64658, 8.45532, ARRAY['641', '642'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bst-altenheim-sued', 'Bürstadt St. Elisabeth / Seniorenzentrum', 'Bürstadt', 49.64642, 8.45508, ARRAY['641', '642'], FALSE, NULL, FALSE, 'Worms', 'Richtung Marktplatz / Worms', ARRAY['Steig 2 (Richtung Marktplatz)']),
    ('stop-bst-beethovenstr-nord', 'Bürstadt Beethovenstraße / Waldgartenstr.', 'Bürstadt', 49.64408, 8.46012, ARRAY['641'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bst-beethovenstr-sued', 'Bürstadt Beethovenstraße / Waldgartenstr.', 'Bürstadt', 49.64392, 8.45988, ARRAY['641'], FALSE, NULL, FALSE, 'Gartenstadt', 'Richtung Gartenstadt', ARRAY['Steig 2 (Richtung Gartenstadt)']),
    ('stop-bst-jugendhaus-nord', 'Bürstadt Jugendhaus / Am Balla-Balla', 'Bürstadt', 49.64058, 8.46162, ARRAY['642', '652'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bst-jugendhaus-sued', 'Bürstadt Jugendhaus / Am Balla-Balla', 'Bürstadt', 49.64042, 8.46138, ARRAY['642', '652'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Boxheimerhof', ARRAY['Steig 2 (Richtung Boxheimerhof)']),
    ('stop-bst-lache-nord', 'Bürstadt Sportzentrum Die Lache / VfR', 'Bürstadt', 49.63558, 8.45812, ARRAY['642'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bst-lache-sued', 'Bürstadt Sportzentrum Die Lache / VfR', 'Bürstadt', 49.63542, 8.45788, ARRAY['642'], FALSE, NULL, FALSE, 'Worms', 'Richtung Hofheim / Worms', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-bst-kiesbuckel-nord', 'Bürstadt Am Kiesbuckel', 'Bürstadt', 49.65008, 8.45812, ARRAY['641'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bst-kiesbuckel-sued', 'Bürstadt Am Kiesbuckel', 'Bürstadt', 49.64992, 8.45788, ARRAY['641'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim', ARRAY['Steig 2 (Richtung Lampertheim)']),
    ('stop-bst-gartenstadt-nord', 'Bürstadt Gartenstadt / Bürstädter Heide', 'Bürstadt', 49.65058, 8.45762, ARRAY['641', '652'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bst-gartenstadt-sued', 'Bürstadt Gartenstadt / Bürstädter Heide', 'Bürstadt', 49.65042, 8.45738, ARRAY['641', '652'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim', ARRAY['Steig 2 (Richtung Lampertheim)']),
    ('stop-bst-heinrichstr-nord', 'Bürstadt Heinrichstraße', 'Bürstadt', 49.64408, 8.45112, ARRAY['642'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bst-heinrichstr-sued', 'Bürstadt Heinrichstraße', 'Bürstadt', 49.64392, 8.45088, ARRAY['642'], FALSE, NULL, FALSE, 'Worms', 'Richtung Sonneneck / Worms', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-bob-altes-rathaus-nord', 'Bobstadt Altes Rathaus / St.-Josef', 'Bobstadt', 49.66358, 8.44662, ARRAY['641', '652'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-bob-altes-rathaus-sued', 'Bobstadt Altes Rathaus / St.-Josef', 'Bobstadt', 49.66342, 8.44638, ARRAY['641', '652'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 2 (Richtung Lampertheim)']),
    ('stop-bob-frankenstr-nord', 'Bobstadt Frankenstraße', 'Bobstadt', 49.66108, 8.44862, ARRAY['641', '652'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-bob-frankenstr-sued', 'Bobstadt Frankenstraße', 'Bobstadt', 49.66092, 8.44838, ARRAY['641', '652'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 2 (Richtung Lampertheim)']),
    ('stop-bob-kurpfalzstr-nord', 'Bobstadt Kurpfalzstraße', 'Bobstadt', 49.66008, 8.44512, ARRAY['641', '652'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-bob-kurpfalzstr-sued', 'Bobstadt Kurpfalzstraße', 'Bobstadt', 49.65992, 8.44488, ARRAY['641', '652'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 2 (Richtung Lampertheim)']),
    ('stop-bob-friedhof-nord', 'Bobstadt Friedhof', 'Bobstadt', 49.66458, 8.44912, ARRAY['641'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-bob-friedhof-sued', 'Bobstadt Friedhof', 'Bobstadt', 49.66442, 8.44888, ARRAY['641'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 2 (Richtung Lampertheim)']),
    ('stop-bob-bahnhof-steig1', 'Bobstadt Bahnhof (Haltepunkt)', 'Bobstadt', 49.66318, 8.44692, ARRAY['641'], FALSE, NULL, TRUE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-bob-bahnhof-steig2', 'Bobstadt Bahnhof (Haltepunkt)', 'Bobstadt', 49.66302, 8.44668, ARRAY['641'], FALSE, NULL, TRUE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 2 (Richtung Lampertheim)']),
    ('stop-rrd-bahnhof-steig1', 'Riedrode Bahnhof', 'Riedrode', 49.64658, 8.48912, ARRAY['643'], FALSE, NULL, TRUE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-rrd-bahnhof-steig2', 'Riedrode Bahnhof', 'Riedrode', 49.64642, 8.48888, ARRAY['643'], FALSE, NULL, TRUE, 'Riedrode', 'Richtung Lorsch / Bensheim', ARRAY['Steig 2 (Richtung Lorsch)']),
    ('stop-rrd-buergerhaus-nord', 'Riedrode Bürgerhaus', 'Riedrode', 49.64758, 8.49112, ARRAY['643'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-rrd-buergerhaus-sued', 'Riedrode Bürgerhaus', 'Riedrode', 49.64742, 8.49088, ARRAY['643'], FALSE, NULL, FALSE, 'Riedrode', 'Richtung Riedrode Bahnhof', ARRAY['Steig 2 (Richtung Bahnhof)']),
    ('stop-rrd-eichendorff-nord', 'Riedrode Eichendorffstraße', 'Riedrode', 49.64858, 8.49362, ARRAY['643'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-rrd-eichendorff-sued', 'Riedrode Eichendorffstraße', 'Riedrode', 49.64842, 8.49338, ARRAY['643'], FALSE, NULL, FALSE, 'Riedrode', 'Richtung Ortsausgang', ARRAY['Steig 2 (Richtung Ortsausgang)']),
    ('stop-la-bahnhof-steig1', 'Lampertheim Bahnhof (ZOB)', 'Lampertheim', 49.59872, 8.47792, ARRAY['641', '644', '652'], FALSE, NULL, TRUE, 'Bürstadt', 'Richtung Bürstadt / Biblis', ARRAY['Bussteig 1 (Richtung Bürstadt)']),
    ('stop-la-bahnhof-steig2', 'Lampertheim Bahnhof (ZOB)', 'Lampertheim', 49.59858, 8.47776, ARRAY['641', '644', '652'], FALSE, NULL, TRUE, 'Lampertheim', 'Richtung Neuschloß / Worms Hbf', ARRAY['Bussteig 2 (Richtung Neuschloß / Worms)']),
    ('stop-la-domkirche-nord', 'Lampertheim Domkirche / Römerstraße', 'Lampertheim', 49.59478, 8.46802, ARRAY['641', '652'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Lampertheim Bahnhof / Bürstadt', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-la-domkirche-sued', 'Lampertheim Domkirche / Römerstraße', 'Lampertheim', 49.59462, 8.46778, ARRAY['641', '652'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Altrhein / Worms', ARRAY['Steig 2 (Richtung Altrhein)']),
    ('stop-la-lessing-gymnasium-nord', 'Lampertheim Lessing-Gymnasium', 'Lampertheim', 49.59888, 8.45522, ARRAY['641', '652'], TRUE, 'Lessing-Gymnasium Lampertheim', FALSE, 'Bürstadt', 'Richtung Lampertheim Bhf / Bürstadt', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-la-lessing-gymnasium-sued', 'Lampertheim Lessing-Gymnasium', 'Lampertheim', 49.59872, 8.45498, ARRAY['641', '652'], TRUE, 'Lessing-Gymnasium Lampertheim', FALSE, 'Lampertheim', 'Richtung Sportzentrum / Schulzentrum', ARRAY['Steig 2 (Richtung Sportzentrum)']),
    ('stop-la-alfred-delp-nord', 'Lampertheim Alfred-Delp-Schule', 'Lampertheim', 49.59928, 8.45692, ARRAY['641', '652'], TRUE, 'Alfred-Delp-Schule (Realschule / Hauptschule)', FALSE, 'Bürstadt', 'Richtung Lampertheim Bhf / Bürstadt', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-la-alfred-delp-sued', 'Lampertheim Alfred-Delp-Schule', 'Lampertheim', 49.59912, 8.45668, ARRAY['641', '652'], TRUE, 'Alfred-Delp-Schule (Realschule / Hauptschule)', FALSE, 'Lampertheim', 'Richtung Schulzentrum West', ARRAY['Steig 2 (Richtung Schulzentrum)']),
    ('stop-la-altes-rathaus-nord', 'Lampertheim Altes Rathaus / Römerstraße', 'Lampertheim', 49.59408, 8.46712, ARRAY['641'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-la-altes-rathaus-sued', 'Lampertheim Altes Rathaus / Römerstraße', 'Lampertheim', 49.59392, 8.46688, ARRAY['641'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-la-sedandamm-nord', 'Lampertheim Sedandamm / Altrhein', 'Lampertheim', 49.59258, 8.46212, ARRAY['641'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-la-sedandamm-sued', 'Lampertheim Sedandamm / Altrhein', 'Lampertheim', 49.59242, 8.46188, ARRAY['641'], FALSE, NULL, FALSE, 'Worms', 'Richtung Altrhein / Worms', ARRAY['Steig 2 (Richtung Altrhein)']),
    ('stop-la-hallenbad-nord', 'Lampertheim Biedensand Bäder / Hallenbad', 'Lampertheim', 49.59758, 8.45512, ARRAY['641'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-la-hallenbad-sued', 'Lampertheim Biedensand Bäder / Hallenbad', 'Lampertheim', 49.59742, 8.45488, ARRAY['641'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Biedensand', ARRAY['Steig 2 (Richtung Biedensand)']),
    ('stop-la-buerstaedter-str-nord', 'Lampertheim Bürstädter Straße', 'Lampertheim', 49.59688, 8.47712, ARRAY['641'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-la-buerstaedter-str-sued', 'Lampertheim Bürstädter Straße', 'Lampertheim', 49.59672, 8.47688, ARRAY['641'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 2 (Richtung Bahnhof)']),
    ('stop-la-pestalozzi-nord', 'Lampertheim Pestalozzischule', 'Lampertheim', 49.59908, 8.46312, ARRAY['641', '652'], TRUE, 'Pestalozzischule Grundschule', FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-la-pestalozzi-sued', 'Lampertheim Pestalozzischule', 'Lampertheim', 49.59892, 8.46288, ARRAY['641', '652'], TRUE, 'Pestalozzischule Grundschule', FALSE, 'Lampertheim', 'Richtung Lessing-Gymnasium', ARRAY['Steig 2 (Richtung Lessing-Gymnasium)']),
    ('stop-la-europabruecke-nord', 'Lampertheim Europabrücke / B44', 'Lampertheim', 49.58908, 8.46612, ARRAY['644'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 1 (Richtung Lampertheim)']),
    ('stop-la-europabruecke-sued', 'Lampertheim Europabrücke / B44', 'Lampertheim', 49.58892, 8.46588, ARRAY['644'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-la-wilhelmstr-nord', 'Lampertheim Wilhelmstraße', 'Lampertheim', 49.59308, 8.47512, ARRAY['641'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-la-wilhelmstr-sued', 'Lampertheim Wilhelmstraße', 'Lampertheim', 49.59292, 8.47488, ARRAY['641'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt', ARRAY['Steig 2 (Richtung Bürstadt)']),
    ('stop-la-chemiestr-nord', 'Lampertheim Chemiestraße', 'Lampertheim', 49.59608, 8.45912, ARRAY['641'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-la-chemiestr-sued', 'Lampertheim Chemiestraße', 'Lampertheim', 49.59592, 8.45888, ARRAY['641'], FALSE, NULL, FALSE, 'Neuschloß', 'Richtung Neuschloß', ARRAY['Steig 2 (Richtung Neuschloß)']),
    ('stop-la-falterweg-nord', 'Lampertheim Falterweg', 'Lampertheim', 49.59708, 8.46912, ARRAY['641'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-la-falterweg-sued', 'Lampertheim Falterweg', 'Lampertheim', 49.59692, 8.46888, ARRAY['641'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt', ARRAY['Steig 2 (Richtung Bürstadt)']),
    ('stop-la-worms-str-nord', 'Lampertheim Wormser Straße (Ost)', 'Lampertheim', 49.59408, 8.46712, ARRAY['641'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-la-worms-str-sued', 'Lampertheim Wormser Straße (Ost)', 'Lampertheim', 49.59392, 8.46688, ARRAY['641'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-la-schlossplatz-west', 'Lampertheim-Neuschloß Schlossplatz', 'Lampertheim', 49.60178, 8.51862, ARRAY['641'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-la-schlossplatz-ost', 'Lampertheim-Neuschloß Schlossplatz', 'Lampertheim', 49.60162, 8.51838, ARRAY['641'], FALSE, NULL, FALSE, 'Hüttenfeld', 'Richtung Hüttenfeld', ARRAY['Steig 2 (Richtung Hüttenfeld)']),
    ('stop-la-ulmenweg-west', 'Lampertheim-Neuschloß Ulmenweg', 'Lampertheim', 49.60058, 8.51512, ARRAY['641'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-la-ulmenweg-ost', 'Lampertheim-Neuschloß Ulmenweg', 'Lampertheim', 49.60042, 8.51488, ARRAY['641'], FALSE, NULL, FALSE, 'Neuschloß', 'Richtung Schlossplatz', ARRAY['Steig 2 (Richtung Schlossplatz)']),
    ('stop-la-lindenweg-west', 'Lampertheim-Neuschloß Lindenweg', 'Lampertheim', 49.60258, 8.51662, ARRAY['641'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-la-lindenweg-ost', 'Lampertheim-Neuschloß Lindenweg', 'Lampertheim', 49.60242, 8.51638, ARRAY['641'], FALSE, NULL, FALSE, 'Neuschloß', 'Richtung Schlossplatz', ARRAY['Steig 2 (Richtung Schlossplatz)']),
    ('stop-la-huettenfeld-buergerhaus-west', 'Lampertheim-Hüttenfeld Bürgerhaus', 'Lampertheim', 49.59808, 8.58312, ARRAY['644'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-la-huettenfeld-buergerhaus-ost', 'Lampertheim-Hüttenfeld Bürgerhaus', 'Lampertheim', 49.59792, 8.58288, ARRAY['644'], FALSE, NULL, FALSE, 'Hüttenfeld', 'Richtung Viernheim', ARRAY['Steig 2 (Richtung Viernheim)']),
    ('stop-la-huettenfeld-litauer-west', 'Lampertheim-Hüttenfeld Litauersiedlung', 'Lampertheim', 49.59908, 8.58112, ARRAY['644'], FALSE, NULL, FALSE, 'Lampertheim', 'Richtung Lampertheim Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-la-huettenfeld-litauer-ost', 'Lampertheim-Hüttenfeld Litauersiedlung', 'Lampertheim', 49.59892, 8.58088, ARRAY['644'], FALSE, NULL, FALSE, 'Hüttenfeld', 'Richtung Bürgerhaus', ARRAY['Steig 2 (Richtung Bürgerhaus)']),
    ('stop-hof-bahnhof-steig1', 'Hofheim (Ried) Bahnhof', 'Hofheim (Ried)', 49.65938, 8.40932, ARRAY['642'], FALSE, NULL, TRUE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-hof-bahnhof-steig2', 'Hofheim (Ried) Bahnhof', 'Hofheim (Ried)', 49.65922, 8.40908, ARRAY['642'], FALSE, NULL, TRUE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-hof-schule-nord', 'Hofheim Nibelungenschule', 'Hofheim (Ried)', 49.65858, 8.41212, ARRAY['642'], TRUE, 'Schule Hofheim (Nibelungenschule)', FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof / EKS', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-hof-schule-sued', 'Hofheim Nibelungenschule', 'Hofheim (Ried)', 49.65842, 8.41188, ARRAY['642'], TRUE, 'Schule Hofheim (Nibelungenschule)', FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-hof-kirche-nord', 'Hofheim Balthasar-Neumann-Kirche', 'Hofheim (Ried)', 49.65908, 8.41262, ARRAY['642'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-hof-kirche-sued', 'Hofheim Balthasar-Neumann-Kirche', 'Hofheim (Ried)', 49.65892, 8.41238, ARRAY['642'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-hof-buergerhaus-nord', 'Hofheim Bürgerhaus / Altes Rathaus', 'Hofheim (Ried)', 49.65808, 8.41112, ARRAY['642'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-hof-buergerhaus-sued', 'Hofheim Bürgerhaus / Altes Rathaus', 'Hofheim (Ried)', 49.65792, 8.41088, ARRAY['642'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-hof-bibliser-weg-nord', 'Hofheim Bibliser Weg', 'Hofheim (Ried)', 49.66158, 8.41362, ARRAY['642'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-hof-bibliser-weg-sued', 'Hofheim Bibliser Weg', 'Hofheim (Ried)', 49.66142, 8.41338, ARRAY['642'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-hof-backhausstr-nord', 'Hofheim Backhausstraße / Nordend', 'Hofheim (Ried)', 49.66258, 8.41462, ARRAY['642'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-hof-backhausstr-sued', 'Hofheim Backhausstraße / Nordend', 'Hofheim (Ried)', 49.66242, 8.41438, ARRAY['642'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-hof-wormser-str-nord', 'Hofheim Wormser Straße (Süd)', 'Hofheim (Ried)', 49.65408, 8.41512, ARRAY['642'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-hof-wormser-str-sued', 'Hofheim Wormser Straße (Süd)', 'Hofheim (Ried)', 49.65392, 8.41488, ARRAY['642'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-hof-friedhof-nord', 'Hofheim Friedhof', 'Hofheim (Ried)', 49.66008, 8.41662, ARRAY['642'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-hof-friedhof-sued', 'Hofheim Friedhof', 'Hofheim (Ried)', 49.65992, 8.41638, ARRAY['642'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-hof-riedstr-nord', 'Hofheim Riedstraße', 'Hofheim (Ried)', 49.65108, 8.42312, ARRAY['642'], FALSE, NULL, FALSE, 'Bürstadt', 'Richtung Bürstadt Bahnhof', ARRAY['Steig 1 (Richtung Bürstadt)']),
    ('stop-hof-riedstr-sued', 'Hofheim Riedstraße', 'Hofheim (Ried)', 49.65092, 8.42288, ARRAY['642'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-bib-bahnhof-steig1', 'Biblis Bahnhof (ZOB)', 'Biblis', 49.68915, 8.4504, ARRAY['644'], FALSE, NULL, TRUE, 'Worms', 'Richtung Wattenheim / Nordheim / Worms', ARRAY['Bussteig 1 (Richtung Worms)']),
    ('stop-bib-bahnhof-steig2', 'Biblis Bahnhof (ZOB)', 'Biblis', 49.68903, 8.45056, ARRAY['644'], FALSE, NULL, TRUE, 'Groß-Rohrheim', 'Richtung Groß-Rohrheim Bahnhof', ARRAY['Bussteig 2 (Richtung Groß-Rohrheim)']),
    ('stop-bib-rathaus-biblis', 'Biblis Rathaus / Darmstädter Straße', 'Biblis', 49.68728, 8.44535, ARRAY['644'], FALSE, NULL, FALSE, 'Biblis', 'Richtung Biblis Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bib-rathaus-worms', 'Biblis Rathaus / Darmstädter Straße', 'Biblis', 49.68712, 8.44505, ARRAY['644'], FALSE, NULL, FALSE, 'Worms', 'Richtung Wattenheim / Worms', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-bib-schule-nord', 'Biblis Schule in den Weschnitzauen / Riedhalle', 'Biblis', 49.6881, 8.45315, ARRAY['644'], TRUE, 'Schule in den Weschnitzauen (Grundschule)', FALSE, 'Biblis', 'Richtung Biblis Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bib-schule-sued', 'Biblis Schule in den Weschnitzauen / Riedhalle', 'Biblis', 49.6879, 8.45285, ARRAY['644'], TRUE, 'Schule in den Weschnitzauen (Grundschule)', FALSE, 'Worms', 'Richtung Wattenheim / Worms', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-bib-kirchstr-nord', 'Biblis Kirchstraße / St. Bartholomäus', 'Biblis', 49.6851, 8.44615, ARRAY['644'], FALSE, NULL, FALSE, 'Biblis', 'Richtung Biblis Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bib-kirchstr-sued', 'Biblis Kirchstraße / St. Bartholomäus', 'Biblis', 49.6849, 8.44585, ARRAY['644'], FALSE, NULL, FALSE, 'Worms', 'Richtung Wattenheim / Worms', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-bib-hintergasse-nord', 'Biblis Hintergasse', 'Biblis', 49.6861, 8.44315, ARRAY['644'], FALSE, NULL, FALSE, 'Biblis', 'Richtung Biblis Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bib-hintergasse-sued', 'Biblis Hintergasse', 'Biblis', 49.6859, 8.44285, ARRAY['644'], FALSE, NULL, FALSE, 'Worms', 'Richtung Wattenheim / Worms', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-bib-buergerzentrum-nord', 'Biblis Bürgerzentrum', 'Biblis', 49.6876, 8.44365, ARRAY['644'], FALSE, NULL, FALSE, 'Biblis', 'Richtung Biblis Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bib-buergerzentrum-sued', 'Biblis Bürgerzentrum', 'Biblis', 49.6874, 8.44335, ARRAY['644'], FALSE, NULL, FALSE, 'Worms', 'Richtung Wattenheim / Worms', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-bib-pfaffenau-nord', 'Biblis Pfaffenau', 'Biblis', 49.6896, 8.45415, ARRAY['644'], FALSE, NULL, FALSE, 'Groß-Rohrheim', 'Richtung Groß-Rohrheim Bahnhof', ARRAY['Steig 1 (Richtung Groß-Rohrheim)']),
    ('stop-bib-pfaffenau-sued', 'Biblis Pfaffenau', 'Biblis', 49.6894, 8.45385, ARRAY['644'], FALSE, NULL, FALSE, 'Biblis', 'Richtung Biblis Bahnhof / Worms', ARRAY['Steig 2 (Richtung Bahnhof)']),
    ('stop-bib-wasserwerk-nord', 'Biblis Am Werrtor / Wertstoffhof', 'Biblis', 49.6913, 8.44515, ARRAY['644'], FALSE, NULL, FALSE, 'Biblis', 'Richtung Biblis Bahnhof', ARRAY['Steig 1 (Richtung Bahnhof)']),
    ('stop-bib-wasserwerk-sued', 'Biblis Am Werrtor / Wertstoffhof', 'Biblis', 49.6911, 8.44485, ARRAY['644'], FALSE, NULL, FALSE, 'Worms', 'Richtung Wattenheim / Worms', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-wat-ortsmitte-biblis', 'Wattenheim Ort / Kirche', 'Biblis', 49.685511, 8.410486, ARRAY['644'], FALSE, NULL, FALSE, 'Biblis', 'Richtung Biblis Bahnhof', ARRAY['Steig 1 (Richtung Biblis)']),
    ('stop-wat-ortsmitte-worms', 'Wattenheim Ort / Kirche', 'Biblis', 49.685383, 8.41036, ARRAY['644'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-wat-rheinstr-biblis', 'Wattenheim Rheinstraße Ost', 'Biblis', 49.68555, 8.4141, ARRAY['644'], FALSE, NULL, FALSE, 'Biblis', 'Richtung Biblis Bahnhof', ARRAY['Steig 1 (Richtung Biblis)']),
    ('stop-wat-rheinstr-worms', 'Wattenheim Rheinstraße Ost', 'Biblis', 49.68545, 8.4139, ARRAY['644'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-wat-steiner-str-biblis', 'Wattenheim Steiner Straße West', 'Biblis', 49.68425, 8.4066, ARRAY['644'], FALSE, NULL, FALSE, 'Biblis', 'Richtung Biblis Bahnhof', ARRAY['Steig 1 (Richtung Biblis)']),
    ('stop-wat-steiner-str-worms', 'Wattenheim Steiner Straße West', 'Biblis', 49.68415, 8.4064, ARRAY['644'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-nor-rathaus-biblis', 'Nordheim Rathaus / Burg-Stein-Museum', 'Biblis', 49.683279, 8.388297, ARRAY['644'], FALSE, NULL, FALSE, 'Biblis', 'Richtung Biblis Bahnhof', ARRAY['Steig 1 (Richtung Biblis)']),
    ('stop-nor-rathaus-worms', 'Nordheim Rathaus / Burg-Stein-Museum', 'Biblis', 49.683006, 8.387821, ARRAY['644'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-nor-steinstr-biblis', 'Nordheim Steinstraße', 'Biblis', 49.678862, 8.387597, ARRAY['644'], FALSE, NULL, FALSE, 'Biblis', 'Richtung Biblis Bahnhof', ARRAY['Steig 1 (Richtung Biblis)']),
    ('stop-nor-steinstr-worms', 'Nordheim Steinstraße', 'Biblis', 49.678705, 8.387633, ARRAY['644'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-nor-friedhof-biblis', 'Nordheim Friedhof / Zum alten Wasserwerk', 'Biblis', 49.684535, 8.392475, ARRAY['644'], FALSE, NULL, FALSE, 'Biblis', 'Richtung Biblis Bahnhof', ARRAY['Steig 1 (Richtung Biblis)']),
    ('stop-nor-friedhof-worms', 'Nordheim Friedhof / Zum alten Wasserwerk', 'Biblis', 49.684517, 8.392376, ARRAY['644'], FALSE, NULL, FALSE, 'Worms', 'Richtung Worms Hbf', ARRAY['Steig 2 (Richtung Worms)']),
    ('stop-gr-bahnhof-steig1', 'Groß-Rohrheim Bahnhof', 'Groß-Rohrheim', 49.71345, 8.47675, ARRAY['644'], FALSE, NULL, TRUE, 'Biblis', 'Richtung Biblis Bahnhof / Worms', ARRAY['Steig 1 (Richtung Biblis)']),
    ('stop-gr-bahnhof-steig2', 'Groß-Rohrheim Bahnhof', 'Groß-Rohrheim', 49.71333, 8.47659, ARRAY['644'], FALSE, NULL, TRUE, 'Groß-Rohrheim', 'Richtung Ortsmitte / Schücostraße', ARRAY['Steig 2 (Richtung Schücostr.)']),
    ('stop-gr-buergerhalle-biblis', 'Groß-Rohrheim Bürgerhalle', 'Groß-Rohrheim', 49.71842, 8.47938, ARRAY['644'], FALSE, NULL, FALSE, 'Biblis', 'Richtung Biblis Bahnhof', ARRAY['Steig 1 (Richtung Biblis)']),
    ('stop-gr-buergerhalle-nord', 'Groß-Rohrheim Bürgerhalle', 'Groß-Rohrheim', 49.71858, 8.47962, ARRAY['644'], FALSE, NULL, FALSE, 'Groß-Rohrheim', 'Richtung Schücostraße', ARRAY['Steig 2 (Richtung Schücostr.)']),
    ('stop-gr-rathaus-biblis', 'Groß-Rohrheim Rathaus', 'Groß-Rohrheim', 49.71742, 8.47838, ARRAY['644'], FALSE, NULL, FALSE, 'Biblis', 'Richtung Biblis Bahnhof', ARRAY['Steig 1 (Richtung Biblis)']),
    ('stop-gr-rathaus-nord', 'Groß-Rohrheim Rathaus', 'Groß-Rohrheim', 49.71758, 8.47862, ARRAY['644'], FALSE, NULL, FALSE, 'Groß-Rohrheim', 'Richtung Schücostraße', ARRAY['Steig 2 (Richtung Schücostr.)']),
    ('stop-gr-friedhof-biblis', 'Groß-Rohrheim Friedhof', 'Groß-Rohrheim', 49.72092, 8.48138, ARRAY['644'], FALSE, NULL, FALSE, 'Biblis', 'Richtung Biblis Bahnhof', ARRAY['Steig 1 (Richtung Biblis)']),
    ('stop-gr-friedhof-nord', 'Groß-Rohrheim Friedhof', 'Groß-Rohrheim', 49.72108, 8.48162, ARRAY['644'], FALSE, NULL, FALSE, 'Groß-Rohrheim', 'Richtung Schücostraße', ARRAY['Steig 2 (Richtung Schücostr.)'])
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    municipality = EXCLUDED.municipality,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    lines = EXCLUDED.lines,
    is_school_stop = EXCLUDED.is_school_stop,
    nearby_school_name = EXCLUDED.nearby_school_name,
    is_train_hub = EXCLUDED.is_train_hub,
    direction = EXCLUDED.direction,
    direction_label = EXCLUDED.direction_label,
    platforms = EXCLUDED.platforms;

-- 8. VRNnextbike Sharing Infrastructure, Individual Bike Tracking & Trips
CREATE TABLE IF NOT EXISTS nextbike_sources (
    sensor_id VARCHAR(64) PRIMARY KEY REFERENCES sensor_metadata(id) ON DELETE CASCADE,
    station_uid BIGINT NOT NULL UNIQUE,
    station_number INTEGER,
    city_id INTEGER NOT NULL,
    city_name TEXT NOT NULL,
    spot BOOLEAN NOT NULL DEFAULT TRUE,
    terminal_type TEXT,
    bike_racks INTEGER NOT NULL DEFAULT 0,
    last_fetched_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS nextbike_bikes (
    bike_number VARCHAR(32) PRIMARY KEY,
    current_station_id VARCHAR(64) REFERENCES sensor_metadata(id) ON DELETE SET NULL,
    current_station_name TEXT,
    bike_type INTEGER,
    electric_lock BOOLEAN DEFAULT TRUE,
    pedelec_battery INTEGER,
    state TEXT DEFAULT 'ok',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    last_seen_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS nextbike_trips (
    id BIGSERIAL PRIMARY KEY,
    bike_number VARCHAR(32) NOT NULL,
    start_station_id VARCHAR(64) REFERENCES sensor_metadata(id) ON DELETE SET NULL,
    start_station_name TEXT,
    end_station_id VARCHAR(64) REFERENCES sensor_metadata(id) ON DELETE SET NULL,
    end_station_name TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_seconds INTEGER,
    distance_meters DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_nextbike_trips_bike ON nextbike_trips(bike_number, end_time DESC);
CREATE INDEX IF NOT EXISTS idx_nextbike_trips_end_time ON nextbike_trips(end_time DESC);

CREATE TABLE IF NOT EXISTS nextbike_observations (
    sensor_id VARCHAR(64) NOT NULL,
    metric VARCHAR(64) NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    bike_numbers TEXT[],
    first_fetched_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (sensor_id, metric, observed_at)
);

-- 8. Traffic Jam (Stau) Tracking for Autobahnen (A67, A5, A6) & Bundesstraßen (B47, B44)
CREATE TABLE IF NOT EXISTS traffic_incidents (
    id VARCHAR(128) PRIMARY KEY,
    road_name VARCHAR(32) NOT NULL,
    direction VARCHAR(128) NOT NULL,
    location_from VARCHAR(128) NOT NULL,
    location_to VARCHAR(128) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    delay_seconds INT NOT NULL DEFAULT 0,
    length_meters INT NOT NULL DEFAULT 0,
    severity VARCHAR(32) NOT NULL DEFAULT 'moderate',
    cause_type VARCHAR(64) NOT NULL DEFAULT 'congestion',
    description TEXT,
    coordinates JSONB,
    source VARCHAR(64) NOT NULL DEFAULT 'autobahn_api',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traffic_active ON traffic_incidents (is_active, road_name);
CREATE INDEX IF NOT EXISTS idx_traffic_time_window ON traffic_incidents (start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_traffic_road_active ON traffic_incidents (road_name, is_active);

-- Hypertable for periodic corridor congestion snapshots (enables air quality / noise correlation)
CREATE TABLE IF NOT EXISTS traffic_corridor_snapshots (
    timestamp TIMESTAMPTZ NOT NULL,
    corridor_id VARCHAR(32) NOT NULL,
    road_name VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    delay_seconds INT NOT NULL DEFAULT 0,
    active_incidents_count INT NOT NULL DEFAULT 0,
    max_length_meters INT NOT NULL DEFAULT 0
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        PERFORM create_hypertable('traffic_corridor_snapshots', 'timestamp', if_not_exists => TRUE);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_traffic_corridor_snapshots ON traffic_corridor_snapshots (corridor_id, timestamp DESC);


ALTER TABLE nextbike_bikes ADD COLUMN IF NOT EXISTS fresh_until TIMESTAMPTZ;

-- Collector migration 20260916: replay receipts and explicit source provenance.
CREATE TABLE IF NOT EXISTS telemetry_ingest_batches (
    batch_id VARCHAR(128) PRIMARY KEY,
    payload_hash VARCHAR(64) NOT NULL,
    committed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE traffic_incidents ADD COLUMN IF NOT EXISTS delay_kind TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE traffic_incidents ADD COLUMN IF NOT EXISTS source_category TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE nextbike_trips ADD COLUMN IF NOT EXISTS evidence TEXT NOT NULL DEFAULT 'inferred_station_change';

-- Old artifact keys are queued in the same transaction that replaces the catalogue.
CREATE TABLE IF NOT EXISTS archive_cleanup (
    key TEXT PRIMARY KEY,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS collector_schema_versions (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO collector_schema_versions(version) VALUES (20260916) ON CONFLICT DO NOTHING;

-- 9. Road Closures (Straßensperrungen) for the Ried Area (Lampertheim, Bürstadt, Biblis, Groß-Rohrheim, etc.)
CREATE TABLE IF NOT EXISTS street_closures (
    id VARCHAR(128) PRIMARY KEY,
    municipality VARCHAR(64) NOT NULL,
    district VARCHAR(64),
    street_name VARCHAR(128) NOT NULL,
    location_from VARCHAR(128),
    location_to VARCHAR(128),
    closure_type VARCHAR(32) NOT NULL DEFAULT 'full',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    reason VARCHAR(255),
    description TEXT,
    detour TEXT,
    coordinates JSONB,
    source VARCHAR(64) NOT NULL DEFAULT 'hessen_mobil',
    source_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_closures_active_status ON street_closures (is_active, status);
CREATE INDEX IF NOT EXISTS idx_closures_time_window ON street_closures (start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_closures_municipality ON street_closures (municipality, district);

INSERT INTO collector_schema_versions(version) VALUES (20260917) ON CONFLICT DO NOTHING;

-- 10. People, Demographics, Commuters & Educational Infrastructure
CREATE TABLE IF NOT EXISTS municipalities (
    id VARCHAR(64) PRIMARY KEY,
    ags VARCHAR(8) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    county VARCHAR(128) NOT NULL DEFAULT 'Kreis Bergstraße',
    state VARCHAR(64) NOT NULL DEFAULT 'Hessen',
    area_sqkm DOUBLE PRECISION NOT NULL,
    center_lat DOUBLE PRECISION NOT NULL,
    center_lng DOUBLE PRECISION NOT NULL,
    boundary_geojson JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demographic_snapshots (
    id BIGSERIAL PRIMARY KEY,
    municipality_id VARCHAR(64) NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    year INT NOT NULL,
    category VARCHAR(64) NOT NULL,
    metric VARCHAR(64) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit VARCHAR(32) NOT NULL DEFAULT 'count',
    dimension VARCHAR(64) NOT NULL DEFAULT 'total',
    source VARCHAR(128) NOT NULL DEFAULT 'hessisches_statistisches_landesamt',
    source_url TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_demographic_snapshot UNIQUE (municipality_id, year, category, metric, dimension)
);

CREATE INDEX IF NOT EXISTS idx_demographics_lookup ON demographic_snapshots (municipality_id, year, category);
CREATE INDEX IF NOT EXISTS idx_demographics_metric ON demographic_snapshots (metric, year);

CREATE TABLE IF NOT EXISTS commuter_flows (
    id BIGSERIAL PRIMARY KEY,
    year INT NOT NULL,
    home_municipality_id VARCHAR(64) NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    partner_ags VARCHAR(8) NOT NULL,
    partner_name VARCHAR(128) NOT NULL,
    direction VARCHAR(16) NOT NULL, -- 'outbound' (Auspendler) | 'inbound' (Einpendler)
    commuter_count INT NOT NULL,
    source VARCHAR(128) NOT NULL DEFAULT 'bundesagentur_fuer_arbeit_pendleratlas',
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_commuter_flow UNIQUE (year, home_municipality_id, partner_ags, direction)
);

CREATE INDEX IF NOT EXISTS idx_commuter_flows_query ON commuter_flows (home_municipality_id, year, direction);

CREATE TABLE IF NOT EXISTS educational_facilities (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    facility_type VARCHAR(64) NOT NULL, -- 'kita', 'krippe', 'grundschule', 'gesamtschule', 'gymnasium', 'foerderschule'
    municipality_id VARCHAR(64) NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    district VARCHAR(64),
    address VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    operator VARCHAR(128) NOT NULL, -- 'stadt_buerstadt', 'stadt_lampertheim', 'kreis_bergstrasse', 'kirche', 'freier_traeger'
    operator_name VARCHAR(255),
    capacity INT,
    current_enrollment INT,
    min_age_years INT,
    max_age_years INT,
    opening_hours VARCHAR(255),
    website_url TEXT,
    reporting_year INT NOT NULL DEFAULT 2025,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edu_municipality ON educational_facilities (municipality_id, facility_type);

-- Seed Ried Municipalities
INSERT INTO municipalities (id, ags, name, county, state, area_sqkm, center_lat, center_lng)
VALUES
    ('buerstadt', '06431005', 'Bürstadt', 'Kreis Bergstraße', 'Hessen', 34.46, 49.6425, 8.4552),
    ('lampertheim', '06431013', 'Lampertheim', 'Kreis Bergstraße', 'Hessen', 72.27, 49.5958, 8.4688),
    ('biblis', '06431003', 'Biblis', 'Kreis Bergstraße', 'Hessen', 40.44, 49.6872, 8.4452),
    ('gross-rohrheim', '06431010', 'Groß-Rohrheim', 'Kreis Bergstraße', 'Hessen', 19.56, 49.7175, 8.4785),
    ('hofheim', '07319000', 'Hofheim (Ried)', 'Stadt Worms / Ried', 'Rheinland-Pfalz', 15.20, 49.6588, 8.4124)
ON CONFLICT (id) DO UPDATE SET
    ags = EXCLUDED.ags,
    name = EXCLUDED.name,
    county = EXCLUDED.county,
    state = EXCLUDED.state,
    area_sqkm = EXCLUDED.area_sqkm,
    center_lat = EXCLUDED.center_lat,
    center_lng = EXCLUDED.center_lng;

-- Seed Baseline Demographic Snapshots (Hessisches Statistisches Landesamt / HSL)
INSERT INTO demographic_snapshots (municipality_id, year, category, metric, value, unit, dimension, source)
VALUES
    -- Bürstadt 2024
    ('buerstadt', 2024, 'population', 'total_population', 16980, 'count', 'total', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'population', 'male_population', 8390, 'count', 'male', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'population', 'female_population', 8590, 'count', 'female', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'population', 'population_density', 492.7, 'per_sqkm', 'total', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'age_structure', 'pop_under_6', 915, 'count', 'age_0_5', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'age_structure', 'pop_6_to_18', 2110, 'count', 'age_6_18', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'age_structure', 'pop_19_to_29', 1845, 'count', 'age_19_29', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'age_structure', 'pop_30_to_49', 4290, 'count', 'age_30_49', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'age_structure', 'pop_50_to_64', 4070, 'count', 'age_50_64', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'age_structure', 'pop_65_plus', 3750, 'count', 'age_65_plus', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'migration', 'births', 142, 'count', 'natural_in', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'migration', 'deaths', 188, 'count', 'natural_out', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'migration', 'inflow', 985, 'count', 'migration_in', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'migration', 'outflow', 860, 'count', 'migration_out', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'migration', 'net_migration', 125, 'count', 'net_balance', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'citizenship', 'foreign_residents', 2680, 'count', 'total', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'citizenship', 'foreign_share_pct', 15.8, 'percent', 'total', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'household', 'avg_household_size', 2.14, 'persons_per_household', 'total', 'hsl_statistik_hessen'),
    ('buerstadt', 2024, 'household', 'total_households', 7935, 'count', 'total', 'hsl_statistik_hessen'),

    -- Lampertheim 2024
    ('lampertheim', 2024, 'population', 'total_population', 33150, 'count', 'total', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'population', 'male_population', 16340, 'count', 'male', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'population', 'female_population', 16810, 'count', 'female', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'population', 'population_density', 458.7, 'per_sqkm', 'total', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'age_structure', 'pop_under_6', 1780, 'count', 'age_0_5', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'age_structure', 'pop_6_to_18', 4120, 'count', 'age_6_18', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'age_structure', 'pop_19_to_29', 3620, 'count', 'age_19_29', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'age_structure', 'pop_30_to_49', 8310, 'count', 'age_30_49', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'age_structure', 'pop_50_to_64', 7940, 'count', 'age_50_64', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'age_structure', 'pop_65_plus', 7380, 'count', 'age_65_plus', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'migration', 'births', 278, 'count', 'natural_in', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'migration', 'deaths', 392, 'count', 'natural_out', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'migration', 'inflow', 1890, 'count', 'migration_in', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'migration', 'outflow', 1675, 'count', 'migration_out', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'migration', 'net_migration', 215, 'count', 'net_balance', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'citizenship', 'foreign_residents', 5810, 'count', 'total', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'citizenship', 'foreign_share_pct', 17.5, 'percent', 'total', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'household', 'avg_household_size', 2.11, 'persons_per_household', 'total', 'hsl_statistik_hessen'),
    ('lampertheim', 2024, 'household', 'total_households', 15710, 'count', 'total', 'hsl_statistik_hessen'),

    -- Biblis 2024
    ('biblis', 2024, 'population', 'total_population', 9210, 'count', 'total', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'population', 'male_population', 4570, 'count', 'male', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'population', 'female_population', 4640, 'count', 'female', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'population', 'population_density', 227.7, 'per_sqkm', 'total', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'age_structure', 'pop_under_6', 485, 'count', 'age_0_5', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'age_structure', 'pop_6_to_18', 1130, 'count', 'age_6_18', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'age_structure', 'pop_19_to_29', 970, 'count', 'age_19_29', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'age_structure', 'pop_30_to_49', 2340, 'count', 'age_30_49', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'age_structure', 'pop_50_to_64', 2285, 'count', 'age_50_64', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'age_structure', 'pop_65_plus', 2000, 'count', 'age_65_plus', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'migration', 'births', 76, 'count', 'natural_in', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'migration', 'deaths', 112, 'count', 'natural_out', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'migration', 'inflow', 540, 'count', 'migration_in', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'migration', 'outflow', 480, 'count', 'migration_out', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'migration', 'net_migration', 60, 'count', 'net_balance', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'citizenship', 'foreign_residents', 1280, 'count', 'total', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'citizenship', 'foreign_share_pct', 13.9, 'percent', 'total', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'household', 'avg_household_size', 2.22, 'persons_per_household', 'total', 'hsl_statistik_hessen'),
    ('biblis', 2024, 'household', 'total_households', 4145, 'count', 'total', 'hsl_statistik_hessen'),

    -- Groß-Rohrheim 2024
    ('gross-rohrheim', 2024, 'population', 'total_population', 3820, 'count', 'total', 'hsl_statistik_hessen'),
    ('gross-rohrheim', 2024, 'population', 'male_population', 1900, 'count', 'male', 'hsl_statistik_hessen'),
    ('gross-rohrheim', 2024, 'population', 'female_population', 1920, 'count', 'female', 'hsl_statistik_hessen'),
    ('gross-rohrheim', 2024, 'population', 'population_density', 195.3, 'per_sqkm', 'total', 'hsl_statistik_hessen'),
    ('gross-rohrheim', 2024, 'age_structure', 'pop_under_6', 205, 'count', 'age_0_5', 'hsl_statistik_hessen'),
    ('gross-rohrheim', 2024, 'age_structure', 'pop_6_to_18', 470, 'count', 'age_6_18', 'hsl_statistik_hessen'),
    ('gross-rohrheim', 2024, 'age_structure', 'pop_19_to_29', 410, 'count', 'age_19_29', 'hsl_statistik_hessen'),
    ('gross-rohrheim', 2024, 'age_structure', 'pop_30_to_49', 975, 'count', 'age_30_49', 'hsl_statistik_hessen'),
    ('gross-rohrheim', 2024, 'age_structure', 'pop_50_to_64', 940, 'count', 'age_50_64', 'hsl_statistik_hessen'),
    ('gross-rohrheim', 2024, 'age_structure', 'pop_65_plus', 820, 'count', 'age_65_plus', 'hsl_statistik_hessen'),
    ('gross-rohrheim', 2024, 'citizenship', 'foreign_residents', 460, 'count', 'total', 'hsl_statistik_hessen'),
    ('gross-rohrheim', 2024, 'citizenship', 'foreign_share_pct', 12.0, 'percent', 'total', 'hsl_statistik_hessen'),
    ('gross-rohrheim', 2024, 'household', 'avg_household_size', 2.26, 'persons_per_household', 'total', 'hsl_statistik_hessen'),

    -- Hofheim (Ried) 2024
    ('hofheim', 2024, 'population', 'total_population', 3350, 'count', 'total', 'stadt_worms_statistik'),
    ('hofheim', 2024, 'population', 'population_density', 220.4, 'per_sqkm', 'total', 'stadt_worms_statistik'),
    ('hofheim', 2024, 'age_structure', 'pop_under_6', 175, 'count', 'age_0_5', 'stadt_worms_statistik'),
    ('hofheim', 2024, 'age_structure', 'pop_6_to_18', 415, 'count', 'age_6_18', 'stadt_worms_statistik'),
    ('hofheim', 2024, 'age_structure', 'pop_19_to_29', 360, 'count', 'age_19_29', 'stadt_worms_statistik'),
    ('hofheim', 2024, 'age_structure', 'pop_30_to_49', 850, 'count', 'age_30_49', 'stadt_worms_statistik'),
    ('hofheim', 2024, 'age_structure', 'pop_50_to_64', 830, 'count', 'age_50_64', 'stadt_worms_statistik'),
    ('hofheim', 2024, 'age_structure', 'pop_65_plus', 720, 'count', 'age_65_plus', 'stadt_worms_statistik'),
    ('hofheim', 2024, 'citizenship', 'foreign_residents', 410, 'count', 'total', 'stadt_worms_statistik'),
    ('hofheim', 2024, 'citizenship', 'foreign_share_pct', 12.2, 'percent', 'total', 'stadt_worms_statistik')
ON CONFLICT (municipality_id, year, category, metric, dimension) DO UPDATE SET
    value = EXCLUDED.value,
    unit = EXCLUDED.unit,
    source = EXCLUDED.source,
    recorded_at = NOW();

-- Seed Key Commuter Patterns (Bundesagentur für Arbeit - Pendleratlas)
INSERT INTO commuter_flows (year, home_municipality_id, partner_ags, partner_name, direction, commuter_count)
VALUES
    -- Bürstadt Outbound (Auspendler - Where Bürstädter work)
    (2024, 'buerstadt', '08222000', 'Mannheim', 'outbound', 1650),
    (2024, 'buerstadt', '07319000', 'Worms', 'outbound', 1280),
    (2024, 'buerstadt', '06431013', 'Lampertheim', 'outbound', 890),
    (2024, 'buerstadt', '07314000', 'Ludwigshafen am Rhein', 'outbound', 720),
    (2024, 'buerstadt', '06412000', 'Frankfurt am Main', 'outbound', 510),
    (2024, 'buerstadt', '06411000', 'Darmstadt', 'outbound', 480),
    (2024, 'buerstadt', '06431002', 'Bensheim', 'outbound', 440),
    (2024, 'buerstadt', '06431011', 'Heppenheim (Bergstraße)', 'outbound', 320),

    -- Bürstadt Inbound (Einpendler - Who comes to Bürstadt to work)
    (2024, 'buerstadt', '06431013', 'Lampertheim', 'inbound', 680),
    (2024, 'buerstadt', '07319000', 'Worms', 'inbound', 640),
    (2024, 'buerstadt', '06431003', 'Biblis', 'inbound', 390),
    (2024, 'buerstadt', '08222000', 'Mannheim', 'inbound', 310),
    (2024, 'buerstadt', '06431002', 'Bensheim', 'inbound', 260),
    (2024, 'buerstadt', '06431010', 'Groß-Rohrheim', 'inbound', 190),

    -- Lampertheim Outbound (Auspendler)
    (2024, 'lampertheim', '08222000', 'Mannheim', 'outbound', 4650),
    (2024, 'lampertheim', '07314000', 'Ludwigshafen am Rhein (BASF)', 'outbound', 2180),
    (2024, 'lampertheim', '07319000', 'Worms', 'outbound', 1820),
    (2024, 'lampertheim', '06412000', 'Frankfurt am Main', 'outbound', 950),
    (2024, 'lampertheim', '06431005', 'Bürstadt', 'outbound', 680),
    (2024, 'lampertheim', '08226101', 'Viernheim', 'outbound', 620),

    -- Lampertheim Inbound (Einpendler)
    (2024, 'lampertheim', '08222000', 'Mannheim', 'inbound', 1420),
    (2024, 'lampertheim', '07319000', 'Worms', 'inbound', 1250),
    (2024, 'lampertheim', '06431005', 'Bürstadt', 'inbound', 890),
    (2024, 'lampertheim', '08226101', 'Viernheim', 'inbound', 540),

    -- Biblis Outbound & Inbound
    (2024, 'biblis', '07319000', 'Worms', 'outbound', 860),
    (2024, 'biblis', '08222000', 'Mannheim', 'outbound', 640),
    (2024, 'biblis', '06411000', 'Darmstadt', 'outbound', 410),
    (2024, 'biblis', '06431005', 'Bürstadt', 'outbound', 390),
    (2024, 'biblis', '06412000', 'Frankfurt am Main', 'outbound', 330),
    (2024, 'biblis', '07319000', 'Worms', 'inbound', 320),
    (2024, 'biblis', '06431005', 'Bürstadt', 'inbound', 240)
ON CONFLICT (year, home_municipality_id, partner_ags, direction) DO UPDATE SET
    commuter_count = EXCLUDED.commuter_count,
    recorded_at = NOW();

-- Seed Educational & Childcare Infrastructure (Schools & Kindergartens)
INSERT INTO educational_facilities (
    id, name, facility_type, municipality_id, district, address, latitude, longitude,
    operator, operator_name, capacity, current_enrollment, min_age_years, max_age_years,
    opening_hours, website_url, reporting_year
)
VALUES
    -- Bürstadt Schools
    ('sch-bst-eks', 'Erich-Kästner-Schule (IGS)', 'gesamtschule', 'buerstadt', 'Bürstadt', 'Wolfstraße 23, 68642 Bürstadt', 49.6483, 8.4615, 'kreis_bergstrasse', 'Kreis Bergstraße Schulamt', 980, 940, 10, 17, 'Mo-Fr 07:30–16:00', 'https://eks-buerstadt.de', 2025),
    ('sch-bst-schillerschule', 'Schillerschule Bürstadt', 'grundschule', 'buerstadt', 'Bürstadt', 'Boxheimerhofstraße 22, 68642 Bürstadt', 49.6496, 8.4618, 'kreis_bergstrasse', 'Kreis Bergstraße', 380, 365, 6, 10, 'Mo-Fr 07:45–14:30', 'https://schillerschule-buerstadt.de', 2025),
    ('sch-bst-astrid-lindgren', 'Astrid-Lindgren-Schule Bobstadt', 'grundschule', 'buerstadt', 'Bobstadt', 'Wolfsfahrtweg 2, 68642 Bürstadt-Bobstadt', 49.6642, 8.4478, 'kreis_bergstrasse', 'Kreis Bergstraße', 140, 128, 6, 10, 'Mo-Fr 07:45–13:30', 'https://als-bobstadt.de', 2025),

    -- Bürstadt Kindergartens / Kitas
    ('kita-bst-wichtelburg', 'Kita Wichtelburg', 'kita', 'buerstadt', 'Bürstadt', 'Rathausstraße 2, 68642 Bürstadt', 49.6420, 8.4558, 'stadt_buerstadt', 'Stadt Bürstadt', 110, 105, 1, 6, 'Mo-Fr 07:00–16:30', 'https://buerstadt.de', 2025),
    ('kita-bst-sonnenschein', 'Kita Sonnenschein', 'kita', 'buerstadt', 'Bürstadt', 'Gartenstraße 14, 68642 Bürstadt', 49.6448, 8.4632, 'stadt_buerstadt', 'Stadt Bürstadt', 125, 120, 1, 6, 'Mo-Fr 07:00–17:00', 'https://buerstadt.de', 2025),
    ('kita-bst-st-peter', 'Katholische Kita St. Peter', 'kita', 'buerstadt', 'Bürstadt', 'Wolfstraße 2, 68642 Bürstadt', 49.6438, 8.4525, 'kirche', 'Kath. Pfarrgemeinde St. Michael', 95, 92, 2, 6, 'Mo-Fr 07:30–16:30', NULL, 2025),
    ('kita-bst-regenbogen', 'Kita Regenbogen Bobstadt', 'kita', 'buerstadt', 'Bobstadt', 'Sankt-Josef-Straße 10, 68642 Bürstadt-Bobstadt', 49.6628, 8.4468, 'stadt_buerstadt', 'Stadt Bürstadt', 85, 82, 1, 6, 'Mo-Fr 07:00–16:30', 'https://buerstadt.de', 2025),
    ('kita-bst-riedrode', 'Waldkindergarten / Kita Riedrode', 'kita', 'buerstadt', 'Riedrode', 'Bahnhofstraße 34, 68642 Bürstadt-Riedrode', 49.6472, 8.4905, 'stadt_buerstadt', 'Stadt Bürstadt', 65, 60, 2, 6, 'Mo-Fr 07:30–15:00', 'https://buerstadt.de', 2025),

    -- Lampertheim Schools
    ('sch-la-lessing-gymnasium', 'Lessing-Gymnasium Lampertheim', 'gymnasium', 'lampertheim', 'Lampertheim', 'Biedensandstraße 55, 68623 Lampertheim', 49.5989, 8.4552, 'kreis_bergstrasse', 'Kreis Bergstraße', 1150, 1110, 10, 19, 'Mo-Fr 07:45–16:30', 'https://lgl.de', 2025),
    ('sch-la-alfred-delp', 'Alfred-Delp-Schule (Haupt- & Realschule)', 'gesamtschule', 'lampertheim', 'Lampertheim', 'Carl-Lepper-Straße 7, 68623 Lampertheim', 49.5992, 8.4568, 'kreis_bergstrasse', 'Kreis Bergstraße', 720, 680, 10, 16, 'Mo-Fr 07:45–15:30', 'https://ads-lampertheim.de', 2025),
    ('sch-la-pestalozzi', 'Pestalozzischule Lampertheim', 'grundschule', 'lampertheim', 'Lampertheim', 'Wilhelmstraße 61, 68623 Lampertheim', 49.5991, 8.4631, 'kreis_bergstrasse', 'Kreis Bergstraße', 340, 325, 6, 10, 'Mo-Fr 07:45–14:00', NULL, 2025),
    ('sch-la-schiller-hofheim', 'Nibelungenschule Hofheim', 'grundschule', 'hofheim', 'Hofheim', 'Schulstraße 4, 68623 Lampertheim-Hofheim', 49.6586, 8.4121, 'stadt_worms', 'Stadt Worms Schulverwaltung', 130, 120, 6, 10, 'Mo-Fr 07:45–13:30', NULL, 2025),

    -- Lampertheim Kindergartens / Kitas
    ('kita-la-falterweg', 'Städtische Kita Falterweg', 'kita', 'lampertheim', 'Lampertheim', 'Falterweg 24, 68623 Lampertheim', 49.5971, 8.4691, 'stadt_lampertheim', 'Stadt Lampertheim', 130, 124, 1, 6, 'Mo-Fr 07:00–17:00', 'https://lampertheim.de', 2025),
    ('kita-la-neuschloss', 'Kita Neuschloß', 'kita', 'lampertheim', 'Neuschloß', 'Ahornweg 12, 68623 Lampertheim-Neuschloß', 49.6012, 8.5165, 'stadt_lampertheim', 'Stadt Lampertheim', 75, 72, 2, 6, 'Mo-Fr 07:00–16:30', 'https://lampertheim.de', 2025),
    ('kita-la-huettenfeld', 'Kita Hüttenfeld (Bürgerhaus)', 'kita', 'lampertheim', 'Hüttenfeld', 'Alfred-Delp-Straße 50, 68623 Lampertheim-Hüttenfeld', 49.5982, 8.5829, 'stadt_lampertheim', 'Stadt Lampertheim', 80, 78, 1, 6, 'Mo-Fr 07:00–16:30', 'https://lampertheim.de', 2025),

    -- Biblis Schools & Kitas
    ('sch-bib-weschnitzauen', 'Schule in den Weschnitzauen', 'grundschule', 'biblis', 'Biblis', 'Pfaffenau 4, 68647 Biblis', 49.6881, 8.4531, 'kreis_bergstrasse', 'Kreis Bergstraße', 320, 305, 6, 10, 'Mo-Fr 07:45–14:00', 'https://schule-biblis.de', 2025),
    ('kita-bib-sonnenschein', 'Kommunale Kita Sonnenschein', 'kita', 'biblis', 'Biblis', 'Kirchstraße 28, 68647 Biblis', 49.6851, 8.4462, 'gemeinde_biblis', 'Gemeinde Biblis', 115, 110, 1, 6, 'Mo-Fr 07:00–16:30', 'https://biblis.de', 2025),
    ('kita-bib-pusteblume-wattenheim', 'Kita Pusteblume Wattenheim', 'kita', 'biblis', 'Wattenheim', 'Rheinstraße 15, 68647 Biblis-Wattenheim', 49.6854, 8.4128, 'gemeinde_biblis', 'Gemeinde Biblis', 65, 62, 2, 6, 'Mo-Fr 07:30–16:00', 'https://biblis.de', 2025),

    -- Groß-Rohrheim
    ('sch-gr-lindenhof', 'Lindenhofschule Groß-Rohrheim', 'grundschule', 'gross-rohrheim', 'Groß-Rohrheim', 'Kornstraße 38, 68649 Groß-Rohrheim', 49.7182, 8.4791, 'kreis_bergstrasse', 'Kreis Bergstraße', 150, 142, 6, 10, 'Mo-Fr 07:45–13:30', NULL, 2025),
    ('kita-gr-abenteuerland', 'Kita Abenteuerland Groß-Rohrheim', 'kita', 'gross-rohrheim', 'Groß-Rohrheim', 'Speyerer Straße 12, 68649 Groß-Rohrheim', 49.7168, 8.4755, 'gemeinde_gross_rohrheim', 'Gemeinde Groß-Rohrheim', 95, 90, 1, 6, 'Mo-Fr 07:00–16:30', NULL, 2025)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    facility_type = EXCLUDED.facility_type,
    municipality_id = EXCLUDED.municipality_id,
    district = EXCLUDED.district,
    address = EXCLUDED.address,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    operator = EXCLUDED.operator,
    operator_name = EXCLUDED.operator_name,
    capacity = EXCLUDED.capacity,
    current_enrollment = EXCLUDED.current_enrollment,
    min_age_years = EXCLUDED.min_age_years,
    max_age_years = EXCLUDED.max_age_years,
    opening_hours = EXCLUDED.opening_hours,
    website_url = EXCLUDED.website_url,
    reporting_year = EXCLUDED.reporting_year;

INSERT INTO collector_schema_versions(version) VALUES (20260918) ON CONFLICT DO NOTHING;

-- 11. Infrastructure, Energy & Connectivity (Straßenzustandsmonitoring, ZAKB Energy, Broadband, EV Charging, Wi-Fi)

-- 11.1 Road Condition / Street Quality (Straßenzustandsmonitoring Kreis Bergstraße / ZAKB Fleet AI)
CREATE TABLE IF NOT EXISTS road_condition_segments (
    id VARCHAR(64) PRIMARY KEY,
    road_name VARCHAR(128) NOT NULL,
    road_class VARCHAR(32) NOT NULL,
    municipality VARCHAR(64) NOT NULL,
    district VARCHAR(64),
    condition_grade DOUBLE PRECISION NOT NULL,
    condition_category VARCHAR(32) NOT NULL,
    potholes_count INT NOT NULL DEFAULT 0,
    cracking_severity VARCHAR(32) DEFAULT 'none',
    surface_type VARCHAR(64) DEFAULT 'asphalt',
    last_inspected_at TIMESTAMPTZ NOT NULL,
    inspected_by VARCHAR(64) DEFAULT 'zakb_fleet_ai',
    coordinates JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_road_cond_muni ON road_condition_segments (municipality, condition_category);
CREATE INDEX IF NOT EXISTS idx_road_cond_grade ON road_condition_segments (condition_grade);

-- 11.2 Renewable Energy Facilities & Generation Telemetry
CREATE TABLE IF NOT EXISTS energy_facilities (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    facility_type VARCHAR(32) NOT NULL,
    operator VARCHAR(128) NOT NULL,
    municipality VARCHAR(64) NOT NULL,
    address VARCHAR(255),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    installed_capacity_kw DOUBLE PRECISION NOT NULL,
    annual_generation_mwh_est DOUBLE PRECISION,
    commissioned_date DATE,
    mastr_id VARCHAR(64),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS energy_production_readings (
    timestamp TIMESTAMPTZ NOT NULL,
    facility_id VARCHAR(64) NOT NULL REFERENCES energy_facilities(id) ON DELETE CASCADE,
    current_power_kw DOUBLE PRECISION NOT NULL,
    energy_today_kwh DOUBLE PRECISION,
    total_energy_mwh DOUBLE PRECISION,
    co2_saved_today_kg DOUBLE PRECISION,
    source VARCHAR(64) NOT NULL DEFAULT 'zakb_telemetry'
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        PERFORM create_hypertable('energy_production_readings', 'timestamp', if_not_exists => TRUE);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_energy_readings_fac_time ON energy_production_readings (facility_id, timestamp DESC);

-- 11.3 Broadband & Fibre Rollout (Breitbandausbau / Gigabit-Grundbuch)
CREATE TABLE IF NOT EXISTS broadband_coverage (
    id VARCHAR(64) PRIMARY KEY,
    municipality VARCHAR(64) NOT NULL,
    district VARCHAR(64) NOT NULL,
    area_name VARCHAR(128) NOT NULL,
    tech_type VARCHAR(32) NOT NULL,
    max_download_mbps INT NOT NULL,
    max_upload_mbps INT NOT NULL,
    rollout_status VARCHAR(32) NOT NULL,
    contract_quota_pct DOUBLE PRECISION,
    primary_provider VARCHAR(128) NOT NULL,
    completion_target_date DATE,
    coordinates JSONB,
    source VARCHAR(64) DEFAULT 'bmdv_gigabit_grundbuch',
    last_updated TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadband_muni_status ON broadband_coverage (municipality, rollout_status);

-- 11.4 EV Charging Infrastructure & Live Utilisation (BNetzA Ladesäulenregister & OCPI)
CREATE TABLE IF NOT EXISTS ev_charging_stations (
    id VARCHAR(64) PRIMARY KEY,
    bnetza_id VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    operator VARCHAR(128) NOT NULL,
    address VARCHAR(255) NOT NULL,
    municipality VARCHAR(64) NOT NULL,
    district VARCHAR(64),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    total_points INT NOT NULL DEFAULT 2,
    max_power_kw DOUBLE PRECISION NOT NULL,
    is_fast_charger BOOLEAN NOT NULL DEFAULT FALSE,
    connector_types TEXT[] NOT NULL DEFAULT ARRAY['Type2'],
    pricing_info TEXT,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    access_hours VARCHAR(64) DEFAULT '24/7',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ev_charging_status (
    station_id VARCHAR(64) PRIMARY KEY REFERENCES ev_charging_stations(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    available_points INT NOT NULL,
    occupied_points INT NOT NULL,
    out_of_service_points INT NOT NULL DEFAULT 0,
    status_source VARCHAR(64) NOT NULL DEFAULT 'live_ocpi'
);

-- 11.5 Public Wi-Fi Hotspots (Hessen-WLAN, Freifunk, etc.)
CREATE TABLE IF NOT EXISTS public_wifi_hotspots (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    ssid VARCHAR(64) NOT NULL,
    operator VARCHAR(128) NOT NULL,
    location_type VARCHAR(64) NOT NULL,
    address VARCHAR(255) NOT NULL,
    municipality VARCHAR(64) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    indoor_outdoor VARCHAR(16) DEFAULT 'outdoor',
    auth_mode VARCHAR(64) DEFAULT 'captive_terms_only',
    bandwidth_mbps INT DEFAULT 50,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wifi_muni ON public_wifi_hotspots (municipality, is_active);

-- Seed Baseline Data for Infrastructure & Energy
INSERT INTO road_condition_segments (id, road_name, road_class, municipality, district, condition_grade, condition_category, potholes_count, cracking_severity, surface_type, last_inspected_at, inspected_by, coordinates)
VALUES
    ('rc-bst-b47-nibelungenstr', 'Nibelungenstraße (B47)', 'bundesstrasse', 'Bürstadt', 'Kernstadt', 2.1, 'gut', 0, 'none', 'asphalt', '2026-08-15T09:30:00Z', 'zakb_fleet_ai', '[[49.6415, 8.4480], [49.6416, 8.4550], [49.6418, 8.4620]]'::jsonb),
    ('rc-bst-mainstr', 'Mainstraße', 'gemeindestrasse', 'Bürstadt', 'Kernstadt', 1.8, 'sehr_gut', 0, 'none', 'asphalt', '2026-08-20T11:15:00Z', 'zakb_fleet_ai', '[[49.6432, 8.4516], [49.6460, 8.4540], [49.6495, 8.4565]]'::jsonb),
    ('rc-bst-industriestr', 'Industriestraße (KAMÜ Kulturzentrum)', 'gemeindestrasse', 'Bürstadt', 'Kernstadt', 3.2, 'befriedigend', 2, 'minor', 'asphalt', '2026-08-18T14:40:00Z', 'zakb_fleet_ai', '[[49.6456, 8.4560], [49.6458, 8.4590], [49.6462, 8.4630]]'::jsonb),
    ('rc-bob-frankenstr', 'Frankenstraße (L3411)', 'landesstrasse', 'Bürstadt', 'Bobstadt', 3.8, 'ausreichend', 4, 'moderate', 'asphalt', '2026-08-12T08:20:00Z', 'zakb_fleet_ai', '[[49.6608, 8.4470], [49.6635, 8.4465], [49.6660, 8.4460]]'::jsonb),
    ('rc-la-b44-roemerstr', 'Römerstraße (B44)', 'bundesstrasse', 'Lampertheim', 'Kernstadt', 2.4, 'gut', 1, 'minor', 'asphalt', '2026-08-22T10:00:00Z', 'zakb_fleet_ai', '[[49.5910, 8.4650], [49.5945, 8.4675], [49.5985, 8.4710]]'::jsonb),
    ('rc-la-l3110-neuschloss', 'Neuschloßstraße (L3110)', 'landesstrasse', 'Lampertheim', 'Neuschloß', 4.1, 'ausreichend', 5, 'severe', 'asphalt', '2026-08-10T13:10:00Z', 'zakb_fleet_ai', '[[49.5990, 8.4850], [49.6010, 8.5050], [49.6018, 8.5180]]'::jsonb),
    ('rc-bib-kirchstr', 'Kirchstraße', 'gemeindestrasse', 'Biblis', 'Kernort', 2.2, 'gut', 0, 'none', 'asphalt', '2026-08-14T15:25:00Z', 'zakb_fleet_ai', '[[49.6845, 8.4455], [49.6870, 8.4452], [49.6890, 8.4450]]'::jsonb),
    ('rc-gr-kornstr', 'Kornstraße', 'gemeindestrasse', 'Groß-Rohrheim', 'Kernort', 2.6, 'befriedigend', 1, 'minor', 'asphalt', '2026-08-16T12:05:00Z', 'zakb_fleet_ai', '[[49.7150, 8.4770], [49.7175, 8.4785], [49.7200, 8.4800]]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    condition_grade = EXCLUDED.condition_grade,
    condition_category = EXCLUDED.condition_category,
    potholes_count = EXCLUDED.potholes_count,
    cracking_severity = EXCLUDED.cracking_severity,
    last_inspected_at = EXCLUDED.last_inspected_at;

INSERT INTO energy_facilities (id, name, facility_type, operator, municipality, address, latitude, longitude, installed_capacity_kw, annual_generation_mwh_est, commissioned_date, mastr_id, description)
VALUES
    ('nrg-zakb-huettenfeld-pv', 'ZAKB Solarpark Energiepark Hüttenfeld', 'solar_pv', 'ZAKB', 'Lampertheim', 'Heidenfahrt 1, 68623 Lampertheim-Hüttenfeld', 49.5965, 8.5845, 3200.0, 3400.0, '2018-06-01', 'SEE984729104821', 'Großflächige Photovoltaik-Freiflächenanlage auf ehemaliger Deponiefläche'),
    ('nrg-zakb-huettenfeld-gas', 'ZAKB Deponiegasverwertung Hüttenfeld (BHKW)', 'landfill_gas', 'ZAKB', 'Lampertheim', 'Heidenfahrt 1, 68623 Lampertheim-Hüttenfeld', 49.5960, 8.5835, 850.0, 5100.0, '2014-03-15', 'SEE932847192019', 'Blockheizkraftwerk zur kontinuierlichen Strom- und Wärmeerzeugung aus Deponiegas'),
    ('nrg-zakb-buerstadt-biogas', 'ZAKB Biogasanlage & Vergärungszentrum Bürstadt', 'biogas', 'ZAKB', 'Bürstadt', 'Außerhalb Biogasanlage 1, 68642 Bürstadt', 49.6385, 8.4480, 1200.0, 8400.0, '2016-11-01', 'SEE910293847561', 'Modernes Bioabfall-Vergärungszentrum mit Biomethaneinspeisung und Ökostrom'),
    ('nrg-bst-boxheimerhof-pv', 'Bürstadt Solarpark Boxheimerhof', 'solar_pv', 'Bürgerenergie Ried eG', 'Bürstadt', 'Boxheimerhof, 68642 Bürstadt', 49.6290, 8.4810, 1500.0, 1650.0, '2020-04-20', 'SEE920192847162', 'Bürgergetragene Photovoltaikanlage zur lokalen Ökostromerzeugung'),
    ('nrg-la-klaerwerk-pv', 'Stadtwerke Lampertheim PV Klärwerk', 'solar_pv', 'Stadtwerke Lampertheim', 'Lampertheim', 'Klärwerkstraße 6, 68623 Lampertheim', 49.6015, 8.4520, 650.0, 700.0, '2022-09-10', 'SEE939102948271', 'Eigenverbrauchs- und Einspeise-PV der Kläranlage Lampertheim')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    installed_capacity_kw = EXCLUDED.installed_capacity_kw,
    annual_generation_mwh_est = EXCLUDED.annual_generation_mwh_est;

INSERT INTO broadband_coverage (id, municipality, district, area_name, tech_type, max_download_mbps, max_upload_mbps, rollout_status, contract_quota_pct, primary_provider, completion_target_date, coordinates)
VALUES
    ('bb-bst-gewerbe-ost', 'Bürstadt', 'Kernstadt', 'Gewerbegebiet Ost / Industriestraße', 'ftth_fibre', 1000, 500, 'active_available', 100.0, 'Deutsche Glasfaser', '2024-06-30', '[[49.644, 8.456], [49.648, 8.465], [49.642, 8.468]]'::jsonb),
    ('bb-bst-kernstadt', 'Bürstadt', 'Kernstadt', 'Bürstadt Kernstadt & Sonneneck', 'ftth_fibre', 1000, 250, 'under_construction', 78.0, 'Telekom / GigaNetz', '2026-12-31', '[[49.638, 8.448], [49.652, 8.456], [49.645, 8.465]]'::jsonb),
    ('bb-bob-bobstadt', 'Bürstadt', 'Bobstadt', 'Bobstadt Gesamtlage', 'vdsl_vectoring', 250, 40, 'planned', 35.0, 'Telekom', '2027-06-30', '[[49.658, 8.442], [49.668, 8.448], [49.662, 8.452]]'::jsonb),
    ('bb-la-neuschloss', 'Lampertheim', 'Neuschloß', 'Neuschloß Wohnsiedlung', 'ftth_fibre', 1000, 500, 'under_construction', 42.0, 'Deutsche GigaNetz', '2026-11-30', '[[49.598, 8.512], [49.605, 8.522], [49.600, 8.525]]'::jsonb),
    ('bb-la-rosenstock', 'Lampertheim', 'Rosenstock', 'Rosenstock & Schulzentrum West', 'ftth_fibre', 1000, 500, 'under_construction', 44.0, 'Deutsche GigaNetz', '2026-12-15', '[[49.595, 8.450], [49.602, 8.460], [49.598, 8.465]]'::jsonb),
    ('bb-la-kernstadt-coax', 'Lampertheim', 'Kernstadt', 'Lampertheim Innenstadt & Sedandamm', 'coax_cable', 1000, 50, 'active_available', 100.0, 'Vodafone', '2023-01-01', '[[49.590, 8.460], [49.598, 8.475], [49.593, 8.480]]'::jsonb),
    ('bb-bib-biblis', 'Biblis', 'Kernort', 'Biblis Kernort & Bahnhofsumfeld', 'ftth_fibre', 1000, 500, 'active_available', 68.0, 'Entega Medianet', '2025-03-31', '[[49.682, 8.440], [49.692, 8.455], [49.686, 8.458]]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    rollout_status = EXCLUDED.rollout_status,
    contract_quota_pct = EXCLUDED.contract_quota_pct;

INSERT INTO ev_charging_stations (id, bnetza_id, name, operator, address, municipality, district, latitude, longitude, total_points, max_power_kw, is_fast_charger, connector_types, is_public)
VALUES
    ('ev-bst-marktplatz', 'DE*ENT*E004812', 'Entega Ladesäule Marktplatz Bürstadt', 'ENTEGA Energie GmbH', 'Marktplatz 1, 68642 Bürstadt', 'Bürstadt', 'Kernstadt', 49.6415, 8.4547, 2, 22.0, FALSE, ARRAY['Type2'], TRUE),
    ('ev-bst-bahnhof', 'DE*PWK*E009182', 'Pfalzwerke Schnellladepark Bürstadt Bahnhof', 'Pfalzwerke ecopower', 'Wilhelminenstraße 2, 68642 Bürstadt', 'Bürstadt', 'Kernstadt', 49.6453, 8.4580, 4, 150.0, TRUE, ARRAY['CCS', 'Type2'], TRUE),
    ('ev-la-schillerplatz', 'DE*SWL*E001290', 'Stadtwerke Ladesäule Schillerplatz Lampertheim', 'Stadtwerke Lampertheim', 'Schillerplatz 1, 68623 Lampertheim', 'Lampertheim', 'Kernstadt', 49.5947, 8.4680, 4, 22.0, FALSE, ARRAY['Type2'], TRUE),
    ('ev-la-biedensand', 'DE*ENT*E005129', 'Entega Biedensand Bäder Lampertheim', 'ENTEGA Energie GmbH', 'Weidweg 40, 68623 Lampertheim', 'Lampertheim', 'Kernstadt', 49.5975, 8.4550, 2, 22.0, FALSE, ARRAY['Type2'], TRUE),
    ('ev-la-neuschloss', 'DE*PWK*E008371', 'Pfalzwerke Neuschloß Schlossplatz', 'Pfalzwerke ecopower', 'Schlossplatz 3, 68623 Lampertheim', 'Lampertheim', 'Neuschloß', 49.6017, 8.5185, 2, 50.0, TRUE, ARRAY['CCS', 'Type2'], TRUE),
    ('ev-bib-bahnhof', 'DE*EWR*E003810', 'EWR Ladesäule Biblis Bahnhof P+R', 'EWR AG', 'Bahnhofstraße 1, 68647 Biblis', 'Biblis', 'Kernort', 49.6891, 8.4504, 2, 22.0, FALSE, ARRAY['Type2'], TRUE),
    ('ev-gr-buergerhalle', 'DE*EBW*E007128', 'EnBW Schnellladestation Bürgerhalle Groß-Rohrheim', 'EnBW', 'Kirchstraße 1, 68649 Groß-Rohrheim', 'Groß-Rohrheim', 'Kernort', 49.7185, 8.4795, 2, 50.0, TRUE, ARRAY['CCS', 'Type2'], TRUE)
ON CONFLICT (id) DO UPDATE SET
    total_points = EXCLUDED.total_points,
    max_power_kw = EXCLUDED.max_power_kw,
    is_fast_charger = EXCLUDED.is_fast_charger;

INSERT INTO ev_charging_status (station_id, timestamp, available_points, occupied_points, out_of_service_points, status_source)
VALUES
    ('ev-bst-marktplatz', NOW(), 1, 1, 0, 'live_ocpi'),
    ('ev-bst-bahnhof', NOW(), 3, 1, 0, 'live_ocpi'),
    ('ev-la-schillerplatz', NOW(), 2, 2, 0, 'live_ocpi'),
    ('ev-la-biedensand', NOW(), 2, 0, 0, 'live_ocpi'),
    ('ev-la-neuschloss', NOW(), 1, 1, 0, 'live_ocpi'),
    ('ev-bib-bahnhof', NOW(), 2, 0, 0, 'live_ocpi'),
    ('ev-gr-buergerhalle', NOW(), 1, 1, 0, 'live_ocpi')
ON CONFLICT (station_id) DO UPDATE SET
    available_points = EXCLUDED.available_points,
    occupied_points = EXCLUDED.occupied_points;

INSERT INTO public_wifi_hotspots (id, name, ssid, operator, location_type, address, municipality, latitude, longitude, indoor_outdoor, auth_mode, bandwidth_mbps)
VALUES
    ('wifi-bst-alla-hopp', 'Hessen-WLAN Bürgerhaus & alla hopp!-Anlage', 'Hessen-WLAN', 'Land Hessen / Stadt Bürstadt', 'sports_park', 'Rathausstraße 2, 68642 Bürstadt', 'Bürstadt', 49.6420, 8.4552, 'outdoor', 'captive_terms_only', 100),
    ('wifi-bst-marktplatz', 'Hessen-WLAN Historisches Rathaus & Marktplatz', 'Hessen-WLAN', 'Stadt Bürstadt', 'market_square', 'Marktplatz 1, 68642 Bürstadt', 'Bürstadt', 49.6414, 8.4546, 'outdoor', 'captive_terms_only', 100),
    ('wifi-bst-kamue', 'Freifunk KAMÜ Kulturzentrum Bürstadt', 'Freifunk', 'KAMÜ & Freifunk Rhein-Neckar', 'community_center', 'Industriestraße 11, 68642 Bürstadt', 'Bürstadt', 49.6457, 8.4582, 'both', 'open', 100),
    ('wifi-la-altrheinhalle', 'Hessen-WLAN Altrheinhalle & Sportzentrum', 'Hessen-WLAN', 'Stadt Lampertheim', 'sports_facility', 'Biedensandstraße 57, 68623 Lampertheim', 'Lampertheim', 49.5982, 8.4542, 'both', 'captive_terms_only', 100),
    ('wifi-la-buergerhaus-neuschloss', 'Hessen-WLAN Bürgerhaus Neuschloß', 'Hessen-WLAN', 'Land Hessen / Stadt Lampertheim', 'community_center', 'Ahornweg 4, 68623 Lampertheim-Neuschloß', 'Lampertheim', 49.6015, 8.5170, 'both', 'captive_terms_only', 50),
    ('wifi-la-rathaus', 'Hessen-WLAN Haus am Dom & Rathaus', 'Hessen-WLAN', 'Stadt Lampertheim', 'town_hall', 'Römerstraße 102, 68623 Lampertheim', 'Lampertheim', 49.5942, 8.4674, 'both', 'captive_terms_only', 100),
    ('wifi-bib-buergerzentrum', 'Hessen-WLAN Bürgerzentrum Biblis', 'Hessen-WLAN', 'Gemeinde Biblis', 'community_center', 'Darmstädter Straße 25, 68647 Biblis', 'Biblis', 49.6875, 8.4435, 'both', 'captive_terms_only', 50)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

INSERT INTO collector_schema_versions(version) VALUES (20260919) ON CONFLICT DO NOTHING;

-- 13. Environment & Agriculture for the Hessisches Ried
CREATE TABLE IF NOT EXISTS nature_protected_areas (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    designation VARCHAR(32) NOT NULL, -- 'nsg' (Naturschutzgebiet), 'ffh', 'spa' (Vogelschutz), 'lsg', 'wsg' (Wasserschutz)
    municipality VARCHAR(64) NOT NULL,
    area_hectares DOUBLE PRECISION,
    legal_ordinance_year INT,
    conservation_aims TEXT,
    visiting_rules JSONB,
    geojson JSONB NOT NULL,
    source VARCHAR(64) NOT NULL DEFAULT 'hlnug_natureg',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nature_areas_municipality ON nature_protected_areas (municipality);
CREATE INDEX IF NOT EXISTS idx_nature_areas_designation ON nature_protected_areas (designation);

CREATE TABLE IF NOT EXISTS agriculture_crop_zones (
    id VARCHAR(64) PRIMARY KEY,
    municipality VARCHAR(64) NOT NULL,
    crop_name VARCHAR(128) NOT NULL,
    crop_family VARCHAR(64) NOT NULL, -- 'sonderkultur', 'gemuese', 'getreide', 'oelfrucht', 'brache'
    year INT NOT NULL,
    area_hectares DOUBLE PRECISION,
    irrigation_demand_class VARCHAR(16) DEFAULT 'medium', -- 'low', 'medium', 'high'
    geojson JSONB NOT NULL,
    source VARCHAR(64) DEFAULT 'invekos_hessen',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agri_crop_year ON agriculture_crop_zones (year, municipality);

CREATE TABLE IF NOT EXISTS agriculture_municipal_stats (
    municipality VARCHAR(64) NOT NULL,
    year INT NOT NULL,
    crop_family VARCHAR(64) NOT NULL,
    crop_name VARCHAR(128) NOT NULL,
    area_hectares DOUBLE PRECISION NOT NULL,
    percentage_of_agricultural_land DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (municipality, year, crop_name)
);

CREATE TABLE IF NOT EXISTS flood_infrastructure (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    infrastructure_type VARCHAR(64) NOT NULL, -- 'polder', 'dike', 'pumping_station', 'weir', 'flood_gate'
    water_body VARCHAR(64) NOT NULL, -- 'Rhein', 'Weschnitz', 'Landgraben'
    municipality VARCHAR(64) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    protection_level VARCHAR(32) DEFAULT 'HQ100',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flood_gauges (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    water_body VARCHAR(64) NOT NULL,
    municipality VARCHAR(64) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    current_level_m DOUBLE PRECISION NOT NULL,
    discharge_m3_s DOUBLE PRECISION,
    alarm_level_1_m DOUBLE PRECISION NOT NULL,
    alarm_level_2_m DOUBLE PRECISION NOT NULL,
    alarm_level_3_m DOUBLE PRECISION NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'normal', -- 'normal' | 'stage_1' | 'stage_2' | 'stage_3'
    source VARCHAR(64) NOT NULL DEFAULT 'pegelonline_wsv',
    source_station_id VARCHAR(64),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS noise_corridors (
    id VARCHAR(128) PRIMARY KEY,
    corridor_type VARCHAR(32) NOT NULL, -- 'rail_riedbahn', 'road_a67', 'road_a5', 'road_b47', 'road_b44'
    name VARCHAR(255) NOT NULL,
    noise_metric VARCHAR(16) NOT NULL, -- 'Lden' | 'Lnight'
    db_band VARCHAR(16) NOT NULL, -- '55-60', '60-65', '65-70', '>70'
    geojson JSONB NOT NULL,
    source VARCHAR(64) NOT NULL DEFAULT 'eba_noise_mapping',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS environmental_map_services (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(128) NOT NULL,
    category VARCHAR(32) NOT NULL, -- 'starkregen', 'flood_risk', 'groundwater', 'protected_areas'
    service_type VARCHAR(16) NOT NULL DEFAULT 'WMS',
    wms_url TEXT NOT NULL,
    layer_name TEXT NOT NULL,
    legend_url TEXT,
    attribution TEXT NOT NULL,
    default_opacity DOUBLE PRECISION DEFAULT 0.65,
    min_zoom INT DEFAULT 10,
    max_zoom INT DEFAULT 19,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Seed Nature Protected Areas
INSERT INTO nature_protected_areas (id, name, designation, municipality, area_hectares, legal_ordinance_year, conservation_aims, visiting_rules, geojson)
VALUES
    ('nsg-lampertheimer-altrhein', 'Naturschutzgebiet Lampertheimer Altrhein', 'nsg', 'Lampertheim', 516.0, 1927, 'Größtes Altrheingebiet Hessens, Auenwälder, Verlandungszonen, Brut- und Rastplatz für über 200 Vogelarten (Störche, Silberreiher, Eisvogel).', '{"leash_required": true, "stay_on_paths": true, "no_drones": true, "no_swimming": true}'::jsonb, '{"type": "Polygon", "coordinates": [[[8.435, 49.585], [8.462, 49.578], [8.472, 49.595], [8.455, 49.610], [8.435, 49.585]]]}'::jsonb),
    ('nsg-biedensand', 'Naturschutzgebiet Biedensand', 'nsg', 'Lampertheim', 250.0, 1984, 'Urtümliche Auenlandschaft, Altwasserarme, seltene Amphibien und Röhrichtbestände.', '{"leash_required": true, "stay_on_paths": true, "no_camping": true}'::jsonb, '{"type": "Polygon", "coordinates": [[[8.442, 49.592], [8.458, 49.590], [8.460, 49.603], [8.445, 49.605], [8.442, 49.592]]]}'::jsonb),
    ('ffh-buerstaedter-wald', 'FFH-Gebiet Bürstädter Wald / Lorcher Wald', 'ffh', 'Bürstadt', 420.0, 2000, 'Naturnahe Hartholz- und Eichenmischwälder, Lebensraum für Hirschkäfer, Bechsteinfledermaus und Schwarzspecht.', '{"stay_on_paths": true, "leash_required": true}'::jsonb, '{"type": "Polygon", "coordinates": [[[8.468, 49.635], [8.498, 49.638], [8.495, 49.655], [8.470, 49.650], [8.468, 49.635]]]}'::jsonb),
    ('nsg-weschnitzinsel', 'Naturschutzgebiet Weschnitzinsel Lorsch', 'nsg', 'Biblis / Lorsch', 198.0, 1979, 'Feuchtwiesen, Storchwiesen und dynamische Auenvegetation entlang der Weschnitz.', '{"stay_on_paths": true, "leash_required": true}'::jsonb, '{"type": "Polygon", "coordinates": [[[8.545, 49.650], [8.572, 49.655], [8.568, 49.670], [8.540, 49.665], [8.545, 49.650]]]}'::jsonb),
    ('wsg-ried-zone-2', 'Wasserschutzgebiet Hessisches Ried (Zone II/III)', 'wsg', 'Bürstadt', 1850.0, 1995, 'Zentrales Grundwasserschutzgebiet für die Trinkwasserversorgung des Rhein-Main-Gebietes und des Rieds.', '{"groundwater_protection": true, "commercial_restrictions": true}'::jsonb, '{"type": "Polygon", "coordinates": [[[8.440, 49.620], [8.485, 49.622], [8.480, 49.660], [8.435, 49.655], [8.440, 49.620]]]}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    area_hectares = EXCLUDED.area_hectares,
    geojson = EXCLUDED.geojson;

-- Seed Agricultural Municipal Statistics (Hessisches Ried: Gemüsegarten Hessens)
INSERT INTO agriculture_municipal_stats (municipality, year, crop_family, crop_name, area_hectares, percentage_of_agricultural_land)
VALUES
    ('Bürstadt', 2025, 'sonderkultur', 'Spargel (Weiß- & Grünspargel)', 485.0, 24.2),
    ('Bürstadt', 2025, 'gemuese', 'Freilandgemüse (Zwiebeln, Möhren, Salat)', 540.0, 27.0),
    ('Bürstadt', 2025, 'sonderkultur', 'Erdbeeren & Beerenobst', 165.0, 8.2),
    ('Bürstadt', 2025, 'getreide', 'Winterweizen & Gerste', 390.0, 19.5),
    ('Bürstadt', 2025, 'getreide', 'Körner- & Silomais', 240.0, 12.0),
    ('Bürstadt', 2025, 'sonderkultur', 'Tabakanbau (Historischer Schauanbau & Nische)', 15.0, 0.8),
    ('Bürstadt', 2025, 'oelfrucht', 'Zuckerrüben & Raps', 165.0, 8.3),
    ('Lampertheim', 2025, 'sonderkultur', 'Spargel (Lampertheimer Spargelstadt)', 620.0, 26.5),
    ('Lampertheim', 2025, 'gemuese', 'Freilandgemüse (Zwiebeln, Bundzwiebeln)', 680.0, 29.0),
    ('Lampertheim', 2025, 'sonderkultur', 'Erdbeeren & Beerenobst', 210.0, 9.0),
    ('Lampertheim', 2025, 'getreide', 'Winterweizen', 430.0, 18.4),
    ('Lampertheim', 2025, 'getreide', 'Silomais', 260.0, 11.1),
    ('Lampertheim', 2025, 'sonderkultur', 'Tabakanbau (Kulturbeleg)', 12.0, 0.5),
    ('Lampertheim', 2025, 'oelfrucht', 'Zuckerrüben', 130.0, 5.5)
ON CONFLICT (municipality, year, crop_name) DO UPDATE SET
    area_hectares = EXCLUDED.area_hectares,
    percentage_of_agricultural_land = EXCLUDED.percentage_of_agricultural_land;

-- Seed Sample Representative Crop Zones (Parcels for Zoom >= 13)
INSERT INTO agriculture_crop_zones (id, municipality, crop_name, crop_family, year, area_hectares, irrigation_demand_class, geojson)
VALUES
    ('crop-bst-spargel-boxheimer', 'Bürstadt', 'Spargel', 'sonderkultur', 2025, 42.5, 'high', '{"type": "Polygon", "coordinates": [[[8.468, 49.638], [8.482, 49.640], [8.480, 49.646], [8.465, 49.644], [8.468, 49.638]]]}'::jsonb),
    ('crop-bst-gemuese-nord', 'Bürstadt', 'Freilandgemüse (Zwiebeln & Möhren)', 'gemuese', 2025, 38.0, 'high', '{"type": "Polygon", "coordinates": [[[8.452, 49.652], [8.468, 49.654], [8.466, 49.660], [8.450, 49.658], [8.452, 49.652]]]}'::jsonb),
    ('crop-la-spargel-heide', 'Lampertheim', 'Spargel', 'sonderkultur', 2025, 55.0, 'high', '{"type": "Polygon", "coordinates": [[[8.472, 49.605], [8.490, 49.607], [8.488, 49.615], [8.470, 49.613], [8.472, 49.605]]]}'::jsonb),
    ('crop-la-erdbeeren-sued', 'Lampertheim', 'Erdbeeren', 'sonderkultur', 2025, 24.0, 'high', '{"type": "Polygon", "coordinates": [[[8.460, 49.588], [8.475, 49.589], [8.473, 49.596], [8.458, 49.594], [8.460, 49.588]]]}'::jsonb),
    ('crop-bib-mais-flur', 'Biblis', 'Körnermais', 'getreide', 2025, 31.0, 'medium', '{"type": "Polygon", "coordinates": [[[8.435, 49.675], [8.450, 49.676], [8.448, 49.683], [8.432, 49.681], [8.435, 49.675]]]}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    crop_name = EXCLUDED.crop_name,
    geojson = EXCLUDED.geojson;

-- Seed Flood Gauges & Infrastructure
INSERT INTO flood_gauges (id, name, water_body, municipality, latitude, longitude, current_level_m, discharge_m3_s, alarm_level_1_m, alarm_level_2_m, alarm_level_3_m, status, source_station_id)
VALUES
    ('pegel-rhein-worms', 'Rheinpegel Worms (km 443.4)', 'Rhein', 'Worms / Riedufer', 49.6315, 8.3755, 2.78, 1420.0, 4.50, 5.50, 6.50, 'normal', 'WORMS'),
    ('pegel-weschnitz-lorsch', 'Weschnitzpegel Lorsch', 'Weschnitz', 'Lorsch / Bürstadt Ost', 49.6542, 8.5670, 0.82, 4.8, 1.80, 2.30, 2.80, 'normal', '23981005')
ON CONFLICT (id) DO UPDATE SET
    current_level_m = EXCLUDED.current_level_m,
    status = EXCLUDED.status,
    updated_at = NOW();

INSERT INTO flood_infrastructure (id, name, infrastructure_type, water_body, municipality, latitude, longitude, protection_level, description)
VALUES
    ('infra-deich-la-biedensand', 'Rheindeich Lampertheim-Biedensand', 'dike', 'Rhein', 'Lampertheim', 49.5950, 8.4450, 'HQ200', 'Hauptdeichlinie zum Schutz der Kernstadt Lampertheim mit Deichschart'),
    ('infra-polder-buerstadt', 'Hochwasserrückhaltepolder Bürstadt / Bobstadt', 'polder', 'Rhein / Landgraben', 'Bürstadt', 49.6580, 8.4250, 'HQ100', 'Flutpolder zur Scheitelkappung bei extremen Rheinhochwässern'),
    ('infra-schoepfwerk-biblis', 'Schöpfwerk Biblis-Wattenheim', 'pumping_station', 'Weschnitz / Rhein', 'Biblis', 49.6880, 8.4050, 'HQ100', 'Entwässerungspumpwerk bei Rheinstau')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- Seed Strategic Noise Corridors (Riedbahn & A67)
INSERT INTO noise_corridors (id, corridor_type, name, noise_metric, db_band, geojson)
VALUES
    ('noise-riedbahn-day-65', 'rail_riedbahn', 'Riedbahn Lärmkorridor Tag (Lden 65-70 dB)', 'Lden', '65-70', '{"type": "LineString", "coordinates": [[8.455, 49.590], [8.456, 49.620], [8.458, 49.650], [8.450, 49.690]]}'::jsonb),
    ('noise-riedbahn-night-60', 'rail_riedbahn', 'Riedbahn Lärmkorridor Nacht (Lnight 60-65 dB)', 'Lnight', '60-65', '{"type": "LineString", "coordinates": [[8.455, 49.590], [8.456, 49.620], [8.458, 49.650], [8.450, 49.690]]}'::jsonb),
    ('noise-a67-day-65', 'road_a67', 'Autobahn A67 Lärmkorridor Tag (Lden 65-70 dB)', 'Lden', '65-70', '{"type": "LineString", "coordinates": [[8.520, 49.580], [8.515, 49.620], [8.525, 49.660], [8.530, 49.700]]}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    geojson = EXCLUDED.geojson;

-- Seed Environmental WMS Tile Services (BKG & Geoportal Hessen)
INSERT INTO environmental_map_services (id, title, category, service_type, wms_url, layer_name, attribution, default_opacity)
VALUES
    ('wms-starkregen-bkg', 'Hinweiskarte Starkregengefahren (BKG)', 'starkregen', 'WMS', 'https://sgx.geodatenzentrum.de/wms_starkregen', 'tiefe_extrem', '© BKG / Bund Geodatenzentrum (dl-de/by-2-0)', 0.65),
    ('wms-hochwasser-hq100', 'Überschwemmungsgebiete HQ100 (HLNUG)', 'flood_risk', 'WMS', 'https://geodienste-umwelt.hessen.de/arcgis/services/inspire/gebiete_naturbedingter_risiken/MapServer/WMSServer', 'Ueberschwemmungsgebiete_HQ100_nach_HWG', '© HLNUG / Hessische Wasserwirtschaft (CC BY 4.0)', 0.55)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    wms_url = EXCLUDED.wms_url,
    layer_name = EXCLUDED.layer_name,
    attribution = EXCLUDED.attribution;

CREATE TABLE IF NOT EXISTS groundwater_stations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    municipality VARCHAR(64) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    depth_to_water_m DOUBLE PRECISION,
    nitrate_mg_l DOUBLE PRECISION,
    measured_at TIMESTAMPTZ,
    hlnug_station_no VARCHAR(32),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Groundwater Monitoring Wells
INSERT INTO groundwater_stations (id, name, municipality, latitude, longitude, depth_to_water_m, nitrate_mg_l, measured_at, hlnug_station_no, description)
VALUES
    ('gw-bst-boxheimerhof', 'Grundwassermessstelle Bürstadt Boxheimerhof', 'Bürstadt', 49.6295, 8.4810, 2.15, 28.4, NOW(), '3021', 'HLNUG Pegel-Nr. 3021: Quartärer Hauptgrundwasserleiter Hessisches Ried'),
    ('gw-bst-riedrode', 'Grundwassermessstelle Bürstadt Riedrode', 'Bürstadt', 49.6480, 8.4950, 1.85, 19.2, NOW(), '3045', 'HLNUG Pegel-Nr. 3045: Oberflächennaher Grundwassermesspunkt'),
    ('gw-la-neuschloss', 'Grundwassermessstelle Lampertheim Neuschloß', 'Lampertheim', 49.6030, 8.5150, 3.40, 22.1, NOW(), '4110', 'HLNUG Pegel-Nr. 4110: Messnetz Grundwassergüte und Flurabstand'),
    ('gw-la-biedensand', 'Grundwassermessstelle Lampertheim Biedensand', 'Lampertheim', 49.5960, 8.4520, 1.20, 14.5, NOW(), '4125', 'HLNUG Pegel-Nr. 4125: Rheinauennahe Grundwasserüberwachung'),
    ('gw-bib-wattenheim', 'Grundwassermessstelle Biblis-Wattenheim', 'Biblis', 49.6860, 8.4110, 2.30, 36.8, NOW(), '3090', 'HLNUG Pegel-Nr. 3090: WRRL-Überwachungsmessstelle Landwirtschaft')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    depth_to_water_m = EXCLUDED.depth_to_water_m,
    nitrate_mg_l = EXCLUDED.nitrate_mg_l,
    measured_at = EXCLUDED.measured_at,
    description = EXCLUDED.description,
    updated_at = NOW();

INSERT INTO collector_schema_versions(version) VALUES (20260920) ON CONFLICT DO NOTHING;

-- 14. Social & Daily Life for the Hessisches Ried
-- Covers Unemployment & SGB II, Healthcare Density & Facilities, Cultural & Sports Associations, ZAKB Waste & Recycling, and Tourism.

CREATE TABLE IF NOT EXISTS municipal_statistics (
    id BIGSERIAL PRIMARY KEY,
    municipality VARCHAR(64) NOT NULL, -- 'Bürstadt', 'Lampertheim', 'Biblis', 'Groß-Rohrheim', 'Kreis Bergstraße', 'Hessen'
    category VARCHAR(64) NOT NULL,     -- 'employment', 'social', 'healthcare_density', 'associations', 'tourism'
    metric_key VARCHAR(64) NOT NULL,   -- 'unemployment_rate', 'sgb2_recipients', 'doctors_per_10k', 'total_clubs', 'tourist_overnights'
    period VARCHAR(32) NOT NULL,       -- '2024', '2025', '2026-Q2', etc.
    period_date DATE NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit VARCHAR(32) NOT NULL,         -- '%', 'count', 'per_10k', 'days'
    benchmark_value DOUBLE PRECISION,  -- Reference value (e.g. Hessen average)
    dimension VARCHAR(64) NOT NULL DEFAULT 'total',
    source VARCHAR(128) NOT NULL,      -- 'Bundesagentur für Arbeit', 'Hessisches Statistisches Landesamt', etc.
    source_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_municipal_metric_period UNIQUE (municipality, metric_key, period, dimension)
);

CREATE INDEX IF NOT EXISTS idx_muni_stats_lookup ON municipal_statistics (municipality, category, period_date DESC);
CREATE INDEX IF NOT EXISTS idx_muni_stats_category ON municipal_statistics (category, period_date DESC);

CREATE TABLE IF NOT EXISTS zakb_waste_statistics (
    id BIGSERIAL PRIMARY KEY,
    municipality VARCHAR(64) NOT NULL, -- 'Bürstadt', 'Lampertheim', 'Kreis Bergstraße'
    year INT NOT NULL,
    fraction VARCHAR(32) NOT NULL,     -- 'restmuell', 'biomuell', 'papier', 'wertstoffe', 'sperrmuell', 'schadstoffe', 'total'
    weight_tons DOUBLE PRECISION NOT NULL,
    kg_per_capita DOUBLE PRECISION NOT NULL,
    recycling_rate_percent DOUBLE PRECISION,
    source VARCHAR(128) DEFAULT 'ZAKB Jahresbericht & HLNUG',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_zakb_waste_stat UNIQUE (municipality, year, fraction)
);

CREATE INDEX IF NOT EXISTS idx_zakb_waste_stats_lookup ON zakb_waste_statistics (municipality, year DESC);

CREATE TABLE IF NOT EXISTS regional_facilities (
    id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,      -- 'healthcare', 'culture_sports', 'tourism'
    facility_type VARCHAR(64) NOT NULL, -- 'pharmacy', 'doctor_gp', 'doctor_specialist', 'sports_complex', 'culture_center', 'attraction'
    municipality VARCHAR(64) NOT NULL,
    district VARCHAR(64),
    street_address VARCHAR(255) NOT NULL,
    postal_code VARCHAR(16) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    phone VARCHAR(64),
    website TEXT,
    description TEXT,
    opening_hours JSONB,
    extra_attributes JSONB,             -- e.g. {"specialty": "Allgemeinmedizin", "emergency_duty": false}
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facilities_category ON regional_facilities (category, facility_type);
CREATE INDEX IF NOT EXISTS idx_facilities_muni ON regional_facilities (municipality);

CREATE TABLE IF NOT EXISTS cultural_events (
    id VARCHAR(128) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    organizer VARCHAR(255) NOT NULL,
    venue_id VARCHAR(128) REFERENCES regional_facilities(id) ON DELETE SET NULL,
    venue_name VARCHAR(255) NOT NULL,
    municipality VARCHAR(64) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    category VARCHAR(64) NOT NULL,     -- 'concert', 'exhibition', 'workshop', 'festival', 'sports', 'civic'
    description TEXT,
    ticket_url TEXT,
    is_free BOOLEAN DEFAULT FALSE,
    source VARCHAR(64) DEFAULT 'kamue_events',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_time ON cultural_events (start_time ASC);

-- Seed Municipal Social Statistics (Unemployment, SGB II, Healthcare Density, Associations, Tourism)
INSERT INTO municipal_statistics (
    municipality, category, metric_key, period, period_date, value, unit, benchmark_value, dimension, source
)
VALUES
    -- 1. Unemployment Rate (Arbeitslosenquote in %) - Bundesagentur für Arbeit (2024–2026)
    ('Bürstadt', 'employment', 'unemployment_rate', '2024', '2024-12-31', 3.9, '%', 5.3, 'total', 'Bundesagentur für Arbeit'),
    ('Bürstadt', 'employment', 'unemployment_rate', '2025', '2025-12-31', 3.8, '%', 5.2, 'total', 'Bundesagentur für Arbeit'),
    ('Bürstadt', 'employment', 'unemployment_rate', '2026-Q2', '2026-06-30', 3.7, '%', 5.1, 'total', 'Bundesagentur für Arbeit'),
    ('Bürstadt', 'employment', 'unemployed_count', '2026-Q2', '2026-06-30', 345, 'count', NULL, 'total', 'Bundesagentur für Arbeit'),
    ('Bürstadt', 'social', 'sgb2_recipients', '2025', '2025-12-31', 680, 'count', NULL, 'total', 'Bundesagentur für Arbeit / Jobcenter'),
    ('Bürstadt', 'social', 'sgb2_quota_pct', '2025', '2025-12-31', 4.0, '%', 6.2, 'total', 'Bundesagentur für Arbeit / Jobcenter'),

    ('Lampertheim', 'employment', 'unemployment_rate', '2024', '2024-12-31', 4.8, '%', 5.3, 'total', 'Bundesagentur für Arbeit'),
    ('Lampertheim', 'employment', 'unemployment_rate', '2025', '2025-12-31', 4.6, '%', 5.2, 'total', 'Bundesagentur für Arbeit'),
    ('Lampertheim', 'employment', 'unemployment_rate', '2026-Q2', '2026-06-30', 4.5, '%', 5.1, 'total', 'Bundesagentur für Arbeit'),
    ('Lampertheim', 'employment', 'unemployed_count', '2026-Q2', '2026-06-30', 820, 'count', NULL, 'total', 'Bundesagentur für Arbeit'),
    ('Lampertheim', 'social', 'sgb2_recipients', '2025', '2025-12-31', 1650, 'count', NULL, 'total', 'Bundesagentur für Arbeit / Jobcenter'),
    ('Lampertheim', 'social', 'sgb2_quota_pct', '2025', '2025-12-31', 5.0, '%', 6.2, 'total', 'Bundesagentur für Arbeit / Jobcenter'),

    ('Biblis', 'employment', 'unemployment_rate', '2025', '2025-12-31', 3.5, '%', 5.2, 'total', 'Bundesagentur für Arbeit'),
    ('Biblis', 'employment', 'unemployed_count', '2025', '2025-12-31', 175, 'count', NULL, 'total', 'Bundesagentur für Arbeit'),
    ('Biblis', 'social', 'sgb2_recipients', '2025', '2025-12-31', 310, 'count', NULL, 'total', 'Bundesagentur für Arbeit / Jobcenter'),

    ('Groß-Rohrheim', 'employment', 'unemployment_rate', '2025', '2025-12-31', 3.2, '%', 5.2, 'total', 'Bundesagentur für Arbeit'),
    ('Groß-Rohrheim', 'employment', 'unemployed_count', '2025', '2025-12-31', 68, 'count', NULL, 'total', 'Bundesagentur für Arbeit'),

    ('Kreis Bergstraße', 'employment', 'unemployment_rate', '2025', '2025-12-31', 4.3, '%', 5.2, 'total', 'Bundesagentur für Arbeit'),
    ('Hessen', 'employment', 'unemployment_rate', '2025', '2025-12-31', 5.2, '%', 5.7, 'total', 'Bundesagentur für Arbeit'),

    -- 2. Healthcare Supply Density (Ärztedichte & Versorgungsgrad) - KV Hessen & HSL
    ('Bürstadt', 'healthcare_density', 'gp_doctors_per_10k', '2025', '2025-12-31', 6.5, 'per_10k', 6.2, 'total', 'Kassenärztliche Vereinigung Hessen'),
    ('Bürstadt', 'healthcare_density', 'specialists_per_10k', '2025', '2025-12-31', 4.7, 'per_10k', 7.8, 'total', 'Kassenärztliche Vereinigung Hessen'),
    ('Bürstadt', 'healthcare_density', 'pharmacies_count', '2025', '2025-12-31', 3.0, 'count', NULL, 'total', 'Landesapothekerkammer Hessen'),
    ('Bürstadt', 'healthcare_density', 'pharmacies_per_10k', '2025', '2025-12-31', 1.77, 'per_10k', 1.85, 'total', 'Landesapothekerkammer Hessen'),
    ('Bürstadt', 'healthcare_density', 'versorgungsgrad_pct', '2025', '2025-12-31', 104.2, '%', 100.0, 'total', 'KV Hessen Bedarfsplanung'),

    ('Lampertheim', 'healthcare_density', 'gp_doctors_per_10k', '2025', '2025-12-31', 6.9, 'per_10k', 6.2, 'total', 'Kassenärztliche Vereinigung Hessen'),
    ('Lampertheim', 'healthcare_density', 'specialists_per_10k', '2025', '2025-12-31', 6.3, 'per_10k', 7.8, 'total', 'Kassenärztliche Vereinigung Hessen'),
    ('Lampertheim', 'healthcare_density', 'pharmacies_count', '2025', '2025-12-31', 7.0, 'count', NULL, 'total', 'Landesapothekerkammer Hessen'),
    ('Lampertheim', 'healthcare_density', 'pharmacies_per_10k', '2025', '2025-12-31', 2.11, 'per_10k', 1.85, 'total', 'Landesapothekerkammer Hessen'),
    ('Lampertheim', 'healthcare_density', 'versorgungsgrad_pct', '2025', '2025-12-31', 101.8, '%', 100.0, 'total', 'KV Hessen Bedarfsplanung'),

    ('Biblis', 'healthcare_density', 'gp_doctors_per_10k', '2025', '2025-12-31', 5.4, 'per_10k', 6.2, 'total', 'Kassenärztliche Vereinigung Hessen'),
    ('Biblis', 'healthcare_density', 'pharmacies_count', '2025', '2025-12-31', 2.0, 'count', NULL, 'total', 'Landesapothekerkammer Hessen'),

    -- 3. Associations & Sports Clubs (Vereinslandschaft) - Vereinsregister Bürstadt & Lampertheim
    ('Bürstadt', 'associations', 'total_clubs', '2025', '2025-12-31', 72, 'count', NULL, 'total', 'Stadt Bürstadt Vereinsregister'),
    ('Bürstadt', 'associations', 'sports_clubs', '2025', '2025-12-31', 24, 'count', NULL, 'sports', 'Stadt Bürstadt Vereinsregister'),
    ('Bürstadt', 'associations', 'cultural_music_clubs', '2025', '2025-12-31', 18, 'count', NULL, 'culture_music', 'Stadt Bürstadt Vereinsregister'),
    ('Bürstadt', 'associations', 'civic_social_clubs', '2025', '2025-12-31', 19, 'count', NULL, 'civic_social', 'Stadt Bürstadt Vereinsregister'),
    ('Bürstadt', 'associations', 'fire_rescue_clubs', '2025', '2025-12-31', 11, 'count', NULL, 'fire_rescue', 'Stadt Bürstadt Vereinsregister'),

    ('Lampertheim', 'associations', 'total_clubs', '2025', '2025-12-31', 118, 'count', NULL, 'total', 'Stadt Lampertheim Vereinsregister'),
    ('Lampertheim', 'associations', 'sports_clubs', '2025', '2025-12-31', 41, 'count', NULL, 'sports', 'Stadt Lampertheim Vereinsregister'),
    ('Lampertheim', 'associations', 'cultural_music_clubs', '2025', '2025-12-31', 28, 'count', NULL, 'culture_music', 'Stadt Lampertheim Vereinsregister'),
    ('Lampertheim', 'associations', 'civic_social_clubs', '2025', '2025-12-31', 33, 'count', NULL, 'civic_social', 'Stadt Lampertheim Vereinsregister'),
    ('Lampertheim', 'associations', 'fire_rescue_clubs', '2025', '2025-12-31', 16, 'count', NULL, 'fire_rescue', 'Stadt Lampertheim Vereinsregister'),

    ('Biblis', 'associations', 'total_clubs', '2025', '2025-12-31', 38, 'count', NULL, 'total', 'Gemeinde Biblis'),

    -- 4. Tourism Metrics (Übernachtungen & Gästeankünfte) - HSL / Tourismus Bergstraße-Odenwald
    ('Kreis Bergstraße', 'tourism', 'tourist_arrivals', '2024', '2024-12-31', 312500, 'count', NULL, 'total', 'Hessisches Statistisches Landesamt'),
    ('Kreis Bergstraße', 'tourism', 'tourist_arrivals', '2025', '2025-12-31', 328400, 'count', NULL, 'total', 'Hessisches Statistisches Landesamt'),
    ('Kreis Bergstraße', 'tourism', 'tourist_overnights', '2024', '2024-12-31', 684200, 'count', NULL, 'total', 'Hessisches Statistisches Landesamt'),
    ('Kreis Bergstraße', 'tourism', 'tourist_overnights', '2025', '2025-12-31', 712000, 'count', NULL, 'total', 'Hessisches Statistisches Landesamt'),
    ('Kreis Bergstraße', 'tourism', 'avg_length_of_stay_days', '2025', '2025-12-31', 2.17, 'days', 2.10, 'total', 'Hessisches Statistisches Landesamt'),
    ('Lampertheim', 'tourism', 'tourist_overnights', '2025', '2025-12-31', 48500, 'count', NULL, 'total', 'HSL / Tourismus Lampertheim'),
    ('Lampertheim', 'tourism', 'avg_length_of_stay_days', '2025', '2025-12-31', 2.35, 'days', 2.10, 'total', 'HSL / Tourismus Lampertheim')
ON CONFLICT (municipality, metric_key, period, dimension) DO UPDATE SET
    value = EXCLUDED.value,
    benchmark_value = EXCLUDED.benchmark_value,
    source = EXCLUDED.source,
    updated_at = NOW();

-- Seed ZAKB Waste Volumes & Recycling Rates (Zweckverband Abfallwirtschaft Kreis Bergstraße)
INSERT INTO zakb_waste_statistics (
    municipality, year, fraction, weight_tons, kg_per_capita, recycling_rate_percent
)
VALUES
    -- Bürstadt 2024
    ('Bürstadt', 2024, 'restmuell', 2040.0, 120.1, 0.0),
    ('Bürstadt', 2024, 'biomuell', 2210.0, 130.2, 98.5),
    ('Bürstadt', 2024, 'papier', 1140.0, 67.1, 99.2),
    ('Bürstadt', 2024, 'wertstoffe', 595.0, 35.0, 88.0),
    ('Bürstadt', 2024, 'sperrmuell', 374.0, 22.0, 62.0),
    ('Bürstadt', 2024, 'total', 6359.0, 374.4, 67.8),

    -- Bürstadt 2025
    ('Bürstadt', 2025, 'restmuell', 1995.0, 117.5, 0.0),
    ('Bürstadt', 2025, 'biomuell', 2280.0, 134.3, 99.0),
    ('Bürstadt', 2025, 'papier', 1120.0, 66.0, 99.4),
    ('Bürstadt', 2025, 'wertstoffe', 615.0, 36.2, 89.5),
    ('Bürstadt', 2025, 'sperrmuell', 355.0, 20.9, 64.0),
    ('Bürstadt', 2025, 'total', 6365.0, 373.9, 68.4),

    -- Lampertheim 2025
    ('Lampertheim', 2025, 'restmuell', 4045.0, 122.0, 0.0),
    ('Lampertheim', 2025, 'biomuell', 4410.0, 133.0, 98.8),
    ('Lampertheim', 2025, 'papier', 2290.0, 69.1, 99.1),
    ('Lampertheim', 2025, 'wertstoffe', 1210.0, 36.5, 89.0),
    ('Lampertheim', 2025, 'sperrmuell', 760.0, 22.9, 63.5),
    ('Lampertheim', 2025, 'total', 12715.0, 383.5, 67.9),

    -- Kreis Bergstraße 2025 (Regional Benchmark)
    ('Kreis Bergstraße', 2025, 'restmuell', 33800.0, 124.5, 0.0),
    ('Kreis Bergstraße', 2025, 'biomuell', 35600.0, 131.1, 98.4),
    ('Kreis Bergstraße', 2025, 'papier', 18700.0, 68.9, 99.0),
    ('Kreis Bergstraße', 2025, 'wertstoffe', 9800.0, 36.1, 88.5),
    ('Kreis Bergstraße', 2025, 'sperrmuell', 6100.0, 22.5, 61.8),
    ('Kreis Bergstraße', 2025, 'total', 104000.0, 383.1, 67.2)
ON CONFLICT (municipality, year, fraction) DO UPDATE SET
    weight_tons = EXCLUDED.weight_tons,
    kg_per_capita = EXCLUDED.kg_per_capita,
    recycling_rate_percent = EXCLUDED.recycling_rate_percent;

-- Seed Regional Facilities (Healthcare, Culture & Sports, Tourism Attractions)
INSERT INTO regional_facilities (
    id, name, category, facility_type, municipality, district, street_address, postal_code,
    latitude, longitude, phone, website, description, opening_hours, extra_attributes
)
VALUES
    -- 1. Healthcare: Pharmacies (Apotheken)
    ('fac-apo-bst-sonnen', 'Sonnen-Apotheke Bürstadt', 'healthcare', 'pharmacy', 'Bürstadt', 'Kernstadt', 'Mainstraße 12', '68642', 49.6425, 8.4528, '06206 6358', 'https://sonnen-apotheke-buerstadt.de', 'Zentrale Apotheke in der Fußgängerzone Bürstadt mit Notdienstbereitschaft.', '{"Mo-Fr": "08:30-18:30", "Sa": "08:30-13:00"}'::jsonb, '{"emergency_duty": false, "wheelchair": true, "prescription_delivery": true}'::jsonb),
    ('fac-apo-bst-nibelungen', 'Nibelungen-Apotheke Bürstadt', 'healthcare', 'pharmacy', 'Bürstadt', 'Kernstadt', 'Wilhelminenstraße 10', '68642', 49.6441, 8.4560, '06206 963131', 'https://nibelungen-apotheke-buerstadt.de', 'Vollversorgende Apotheke nahe Bahnhof Bürstadt.', '{"Mo-Fr": "08:30-18:30", "Sa": "09:00-13:00"}'::jsonb, '{"emergency_duty": true, "wheelchair": true}'::jsonb),
    ('fac-apo-la-andreas', 'Andreas-Apotheke Lampertheim', 'healthcare', 'pharmacy', 'Lampertheim', 'Kernstadt', 'Kaiserstraße 18', '68623', 49.5938, 8.4682, '06206 2445', 'https://andreas-apotheke-lampertheim.de', 'Traditionsapotheke im Zentrum von Lampertheim.', '{"Mo-Fr": "08:00-19:00", "Sa": "08:30-14:00"}'::jsonb, '{"emergency_duty": true, "wheelchair": true}'::jsonb),
    ('fac-apo-la-schiller', 'Schiller-Apotheke Lampertheim', 'healthcare', 'pharmacy', 'Lampertheim', 'Kernstadt', 'Schillerplatz 3', '68623', 49.5948, 8.4680, '06206 59288', 'https://schiller-apotheke-lampertheim.de', 'Apotheke am Schillerplatz.', '{"Mo-Fr": "08:30-18:30", "Sa": "08:30-13:00"}'::jsonb, '{"emergency_duty": false, "wheelchair": true}'::jsonb),
    ('fac-apo-bib-weschnitz', 'Weschnitz-Apotheke Biblis', 'healthcare', 'pharmacy', 'Biblis', 'Kernort', 'Darmstädter Straße 14', '68647', 49.6870, 8.4455, '06245 7064', 'https://weschnitz-apotheke.de', 'Apotheke im Ortskern von Biblis.', '{"Mo-Fr": "08:30-18:30", "Sa": "08:30-12:30"}'::jsonb, '{"emergency_duty": false, "wheelchair": true}'::jsonb),

    -- 2. Healthcare: Doctors & Medical Centers (Ärzte)
    ('fac-doc-bst-hausarzt', 'Hausarztzentrum & Allgemeinmedizin Bürstadt', 'healthcare', 'doctor_gp', 'Bürstadt', 'Kernstadt', 'Nibelungenstraße 42', '68642', 49.6416, 8.4532, '06206 70010', 'https://hausarzt-buerstadt.de', 'Gemeinschaftspraxis für Allgemeinmedizin, Innere Medizin und Akutversorgung.', '{"Mo-Fr": "08:00-12:00, 15:00-18:00"}'::jsonb, '{"specialty": "Allgemeinmedizin", "accepting_new_patients": true}'::jsonb),
    ('fac-doc-la-mvz', 'Medizinisches Versorgungszentrum (MVZ) Lampertheim', 'healthcare', 'doctor_specialist', 'Lampertheim', 'Kernstadt', 'Neue Schulstraße 28', '68623', 49.5962, 8.4715, '06206 9450', 'https://mvz-lampertheim.de', 'Fachärztliches Versorgungszentrum: Orthopädie, Kardiologie & Chirurgie.', '{"Mo-Fr": "08:00-18:00"}'::jsonb, '{"specialty": "Facharztzentrum", "wheelchair": true}'::jsonb),
    ('fac-doc-la-kinderarzt', 'Praxis für Kinder- und Jugendmedizin Lampertheim', 'healthcare', 'doctor_specialist', 'Lampertheim', 'Kernstadt', 'Wilhelmstraße 45', '68623', 49.5932, 8.4745, '06206 3211', NULL, 'Pädiatrische Grund- und Notfallversorgung für das Ried.', '{"Mo-Fr": "08:30-12:30, 14:00-17:00"}'::jsonb, '{"specialty": "Kinder- & Jugendmedizin"}'::jsonb),

    -- 3. Culture & Sports: KAMÜ, Venues, Grounds, Halls
    ('fac-kamue-kulturzentrum', 'KAMÜ Kulturzentrum Bürstadt', 'culture_sports', 'culture_center', 'Bürstadt', 'Kernstadt', 'Industriestraße 11', '68642', 49.6457, 8.4582, '06206 157980', 'https://kamue.me', 'Soziokulturelles Zentrum, Initiator von Open Ried Sens, Raum für Konzerte, Theater, Maker-Workshops und Hackathons.', '{"Di-So": "16:00-22:00"}'::jsonb, '{"is_kamue_hub": true, "capacity": 250, "maker_lab": true}'::jsonb),
    ('fac-bst-sportpark', 'Sportpark Bürstadt & alla hopp!-Bewegungsanlage', 'culture_sports', 'sports_complex', 'Bürstadt', 'Kernstadt', 'Wasserwerkstraße 4', '68642', 49.6385, 8.4595, '06206 7010', 'https://buerstadt.de/sportpark', 'Moderner Bürger- und Vereinssportpark mit Leichtathletikanlagen, Kunstrasen und Mehrgenerationen-Parcours.', '{"Mo-So": "08:00-21:30"}'::jsonb, '{"free_access_area": true, "lighted": true}'::jsonb),
    ('fac-bst-vfr-lache', 'Sportgelände VfR 1910 Bürstadt (Die Lache)', 'culture_sports', 'sports_complex', 'Bürstadt', 'Kernstadt', 'Die Lache 1', '68642', 49.6355, 8.4580, '06206 6128', 'https://vfr-buerstadt.de', 'Traditioneller Fußballverein mit Naturrasenstadion und Vereinsheim.', '{"Di-So": "17:00-22:00"}'::jsonb, '{"teams_count": 14}'::jsonb),
    ('fac-la-altrheinhalle', 'Altrheinhalle & Sportzentrum Lampertheim', 'culture_sports', 'sports_complex', 'Lampertheim', 'Kernstadt', 'Biedensandstraße 57', '68623', 49.5982, 8.4542, '06206 9350', 'https://lampertheim.de', 'Zentrale Dreifelderhalle für Hand-, Basket- und Hallenballsport sowie Großveranstaltungen.', '{"Mo-Sa": "08:00-22:00"}'::jsonb, '{"tribune_capacity": 800}'::jsonb),
    ('fac-la-kanuclub', 'Wassersportzentrum / Kanu-Club Lampertheim', 'culture_sports', 'sports_complex', 'Lampertheim', 'Kernstadt', 'Römerstraße 108 / Altrhein', '68623', 49.5915, 8.4610, '06206 4501', 'https://kanu-club-lampertheim.de', 'Bundesstützpunkt-Nachwuchs Kanu-Rennsport und Breitensport am Altrheinarm.', '{"Mo-So": "09:00-20:00"}'::jsonb, '{"water_access": true}'::jsonb),
    ('fac-bst-buergerhaus', 'Bürgerhaus & Historisches Rathaus Bürstadt', 'culture_sports', 'culture_center', 'Bürstadt', 'Kernstadt', 'Rathausstraße 2', '68642', 49.6415, 8.4548, '06206 7010', 'https://buerstadt.de', 'Veranstaltungssaal für Konzerte, Theater, Bürgerversammlungen und Tagungen.', '{"Mo-Fr": "08:00-18:00"}'::jsonb, '{"capacity": 450}'::jsonb),

    -- 4. Tourism & Nature Attractions
    ('fac-tour-kloster-lorsch', 'UNESCO Welterbe Kloster Lorsch & Freilichtlabor Lauresham', 'tourism', 'attraction', 'Lorsch', 'Klosterbezirk', 'Im Klosterbezirk 1', '64653', 49.6538, 8.5695, '06251 869200', 'https://kloster-lorsch.de', 'Karolingische Königshalle (UNESCO-Weltkulturerbe 1991), Experimentalarchäologisches Freilichtlabor Lauresham und Kräutergarten.', '{"Di-So": "10:00-17:00"}'::jsonb, '{"unesco_world_heritage": true, "guided_tours": true}'::jsonb),
    ('fac-tour-biedensand', 'Naturschutzgebiet Lampertheimer Altrhein (Biedensand)', 'tourism', 'attraction', 'Lampertheim', 'Biedensand', 'Biedensandstraße', '68623', 49.5960, 8.4480, '06206 9350', 'https://lampertheim.de', 'Größte Auenlandschaft Hessens mit Rundwanderwegen, Vogelbeobachtungstürmen und Altrheinarmen.', '{"Mo-So": "00:00-24:00"}'::jsonb, '{"trail_length_km": 14.5, "birdwatching": true}'::jsonb),
    ('fac-tour-biedensand-baeder', 'Biedensand Bäder Lampertheim (Hallen- & Freibad)', 'tourism', 'attraction', 'Lampertheim', 'Kernstadt', 'Weidweg 40', '68623', 49.5975, 8.4548, '06206 94460', 'https://biedensand-baeder.de', 'Beliebtes Freizeit- und Erlebnisbad mit großer Liegewiese, 50m-Becken und Saunalandschaft.', '{"Di-Fr": "06:30-21:00", "Sa-So": "08:00-20:00"}'::jsonb, '{"open_air_pool": true, "sauna": true}'::jsonb),
    ('fac-tour-domkirche', 'Domkirche Lampertheim (Lukasgemeinde)', 'tourism', 'attraction', 'Lampertheim', 'Kernstadt', 'Römerstraße 100', '68623', 49.5945, 8.4678, '06206 2446', 'https://lukasgemeinde-lampertheim.de', 'Größte neugotische Hallenkirche Südhessens, Wahrzeichen der Spargelstadt.', '{"Mo-So": "09:00-18:00"}'::jsonb, '{"architectural_style": "Neugotik"}'::jsonb),
    ('fac-tour-boxheimerhof', 'Historischer Boxheimerhof Bürstadt', 'tourism', 'attraction', 'Bürstadt', 'Boxheimerhof', 'Boxheimerhof 1', '68642', 49.6290, 8.4800, NULL, 'https://buerstadt.de', 'Ehemaliger Gutshof des Klosters Lorsch mit historischer Kapelle St. Anna (1285).', '{"Mo-So": "00:00-24:00"}'::jsonb, '{"historic_monument": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    facility_type = EXCLUDED.facility_type,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    phone = EXCLUDED.phone,
    website = EXCLUDED.website,
    description = EXCLUDED.description,
    opening_hours = EXCLUDED.opening_hours,
    extra_attributes = EXCLUDED.extra_attributes,
    updated_at = NOW();

-- Seed Cultural & Community Events (Featuring KAMÜ Kulturzentrum)
INSERT INTO cultural_events (
    id, title, organizer, venue_id, venue_name, municipality, start_time, end_time, category, description, ticket_url, is_free
)
VALUES
    ('evt-kamue-hackathon-info', 'Open Ried Sens & Smart City Hackathon Infoabend', 'KAMÜ Kulturzentrum', 'fac-kamue-kulturzentrum', 'KAMÜ Kulturzentrum Bürstadt', 'Bürstadt', '2026-10-15 18:30:00+02', '2026-10-15 21:30:00+02', 'workshop', 'Einführung in die offenen Sensordaten, API-Zugriff, Sensorknoten-Bau und Themen für den regionalen Ried-Hackathon.', 'https://kamue.me/events/hackathon-kickoff', TRUE),
    ('evt-kamue-live-acoustic', 'Ried Acoustic Session – Lokale Singer/Songwriter', 'KAMÜ Kulturzentrum', 'fac-kamue-kulturzentrum', 'KAMÜ Kulturzentrum Bürstadt', 'Bürstadt', '2026-10-24 20:00:00+02', '2026-10-24 23:00:00+02', 'concert', 'Gemütlicher Live-Musikabend mit Künstlern aus dem Ried und der Metropolregion Rhein-Neckar.', 'https://kamue.me/tickets', FALSE),
    ('evt-bst-stadtlauf', '34. Bürstädter Stadtlauf & Schülercup', 'TSG Bürstadt / Stadt Bürstadt', 'fac-bst-sportpark', 'Sportpark Bürstadt & Bürgerhaus', 'Bürstadt', '2026-11-08 09:30:00+01', '2026-11-08 14:00:00+01', 'sports', 'Traditioneller Volkslauf mit 5 km, 10 km und Schülerstaffeln durch Bürstadt.', 'https://buerstadt.de/stadtlauf', FALSE),
    ('evt-la-spargel-herbst', 'Lampertheimer Erntedank- & Spargel-Kulturabend', 'Stadt Lampertheim', 'fac-la-altrheinhalle', 'Altrheinhalle Lampertheim', 'Lampertheim', '2026-10-18 17:00:00+02', '2026-10-18 22:00:00+02', 'festival', 'Regionales Kulturprogramm, Musik der Stadtkapelle und kulinarische Ried-Spezialitäten.', 'https://lampertheim.de/veranstaltungen', TRUE),
    ('evt-zakb-repair-cafe', 'ZAKB Repair-Café & Zero-Waste Workshop', 'ZAKB & Bürgerstiftung', 'fac-bst-buergerhaus', 'Bürgerhaus Bürstadt', 'Bürstadt', '2026-11-14 14:00:00+01', '2026-11-14 17:30:00+01', 'civic', 'Gemeinsam defekte Haushaltsgeräte, Fahrräder und Elektronik reparieren statt wegwerfen.', 'https://zakb.de/repair-cafe', TRUE)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    description = EXCLUDED.description;

INSERT INTO collector_schema_versions(version) VALUES (20260921) ON CONFLICT DO NOTHING;
