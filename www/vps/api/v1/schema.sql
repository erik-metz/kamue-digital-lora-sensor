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
    platforms TEXT[] DEFAULT ARRAY['Steig 1'],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Seed Ried Bus Stops (all municipalities in the Ried corridor)
INSERT INTO bus_stops (id, name, municipality, latitude, longitude, lines, is_school_stop, nearby_school_name, is_train_hub)
VALUES
    -- Bürstadt
    ('stop-bst-bahnhof', 'Bürstadt Bahnhof (ZOB)', 'Bürstadt', 49.6458, 8.4563, ARRAY['641', '642', '643', '652'], FALSE, NULL, TRUE),
    ('stop-bst-marktplatz', 'Bürstadt Marktplatz / Historisches Rathaus', 'Bürstadt', 49.6425, 8.4542, ARRAY['641', '642', '652'], FALSE, NULL, FALSE),
    ('stop-bst-eks', 'Bürstadt Erich-Kästner-Schule', 'Bürstadt', 49.6385, 8.4610, ARRAY['642', '652'], TRUE, 'Erich-Kästner-Schule (Integrierte Gesamtschule)', FALSE),
    ('stop-bst-schillerschule', 'Bürstadt Schillerschule / Rathaus', 'Bürstadt', 49.6438, 8.4568, ARRAY['641', '652'], TRUE, 'Schillerschule Grundschule', FALSE),
    ('stop-bst-boxheimerhof', 'Bürstadt Boxheimerhof', 'Bürstadt', 49.6520, 8.4550, ARRAY['641', '652'], FALSE, NULL, FALSE),
    ('stop-bst-sonneneck', 'Bürstadt Sonneneck / Mainstraße Süd', 'Bürstadt', 49.6432, 8.4515, ARRAY['642'], FALSE, NULL, FALSE),
    ('stop-bst-nibelungenstr', 'Bürstadt Nibelungenstraße (B47)', 'Bürstadt', 49.6415, 8.4530, ARRAY['642', '643'], FALSE, NULL, FALSE),
    ('stop-bst-wilhelminenstr', 'Bürstadt Wilhelminenstraße', 'Bürstadt', 49.6480, 8.4565, ARRAY['641', '652'], FALSE, NULL, FALSE),
    ('stop-bst-wasserwerk', 'Bürstadt Wasserwerk', 'Bürstadt', 49.6390, 8.4590, ARRAY['642'], FALSE, NULL, FALSE),
    ('stop-bst-industriestr', 'Bürstadt Industriestraße / KAMÜ Kulturzentrum', 'Bürstadt', 49.6457, 8.4582, ARRAY['641', '643'], FALSE, NULL, FALSE),
    ('stop-bst-altenheim', 'Bürstadt St. Elisabeth / Seniorenzentrum', 'Bürstadt', 49.6465, 8.4552, ARRAY['641', '642'], FALSE, NULL, FALSE),
    ('stop-bst-beethovenstr', 'Bürstadt Beethovenstraße / Waldgartenstr.', 'Bürstadt', 49.6440, 8.4600, ARRAY['641'], FALSE, NULL, FALSE),
    ('stop-bst-jugendhaus', 'Bürstadt Jugendhaus / Am Balla-Balla', 'Bürstadt', 49.6370, 8.4630, ARRAY['642', '652'], FALSE, NULL, FALSE),
    ('stop-bst-lache', 'Bürstadt Sportzentrum Die Lache / VfR', 'Bürstadt', 49.6355, 8.4580, ARRAY['642'], FALSE, NULL, FALSE),
    ('stop-bst-kiesbuckel', 'Bürstadt Am Kiesbuckel', 'Bürstadt', 49.6500, 8.4580, ARRAY['641'], FALSE, NULL, FALSE),
    ('stop-bst-gartenstadt', 'Bürstadt Gartenstadt / Bürstädter Heide', 'Bürstadt', 49.6505, 8.4575, ARRAY['641', '652'], FALSE, NULL, FALSE),
    ('stop-bst-heinrichstr', 'Bürstadt Heinrichstraße', 'Bürstadt', 49.6440, 8.4510, ARRAY['642'], FALSE, NULL, FALSE),

    -- Bobstadt
    ('stop-bob-altes-rathaus', 'Bobstadt Altes Rathaus / St.-Josef', 'Bobstadt', 49.6635, 8.4465, ARRAY['641', '652'], FALSE, NULL, FALSE),
    ('stop-bob-frankenstr', 'Bobstadt Frankenstraße', 'Bobstadt', 49.6610, 8.4485, ARRAY['641', '652'], FALSE, NULL, FALSE),
    ('stop-bob-kurpfalzstr', 'Bobstadt Kurpfalzstraße', 'Bobstadt', 49.6600, 8.4450, ARRAY['641', '652'], FALSE, NULL, FALSE),
    ('stop-bob-friedhof', 'Bobstadt Friedhof', 'Bobstadt', 49.6645, 8.4490, ARRAY['641'], FALSE, NULL, FALSE),
    ('stop-bob-bahnhof', 'Bobstadt Bahnhof (Haltepunkt)', 'Bobstadt', 49.6631, 8.4468, ARRAY['641'], FALSE, NULL, TRUE),

    -- Riedrode
    ('stop-rrd-bahnhof', 'Riedrode Bahnhof', 'Riedrode', 49.6465, 8.4890, ARRAY['643'], FALSE, NULL, TRUE),
    ('stop-rrd-buergerhaus', 'Riedrode Bürgerhaus', 'Riedrode', 49.6475, 8.4910, ARRAY['643'], FALSE, NULL, FALSE),
    ('stop-rrd-eichendorff', 'Riedrode Eichendorffstraße', 'Riedrode', 49.6485, 8.4935, ARRAY['643'], FALSE, NULL, FALSE),

    -- Lampertheim
    ('stop-la-bahnhof', 'Lampertheim Bahnhof (ZOB)', 'Lampertheim', 49.5980, 8.4760, ARRAY['641', '644', '652'], FALSE, NULL, TRUE),
    ('stop-la-domkirche', 'Lampertheim Domkirche / Schillerplatz', 'Lampertheim', 49.5955, 8.4635, ARRAY['641', '652'], FALSE, NULL, FALSE),
    ('stop-la-lessing-gymnasium', 'Lampertheim Lessing-Gymnasium', 'Lampertheim', 49.5932, 8.4715, ARRAY['641', '652'], TRUE, 'Lessing-Gymnasium Lampertheim', FALSE),
    ('stop-la-alfred-delp', 'Lampertheim Alfred-Delp-Schule', 'Lampertheim', 49.5975, 8.4830, ARRAY['641', '652'], TRUE, 'Alfred-Delp-Schule (Realschule / Hauptschule)', FALSE),
    ('stop-la-altes-rathaus', 'Lampertheim Altes Rathaus / Römerstraße', 'Lampertheim', 49.5960, 8.4650, ARRAY['641'], FALSE, NULL, FALSE),
    ('stop-la-sedandamm', 'Lampertheim Sedandamm / Altrhein', 'Lampertheim', 49.5925, 8.4620, ARRAY['641'], FALSE, NULL, FALSE),
    ('stop-la-hallenbad', 'Lampertheim Biedensand Bäder / Hallenbad', 'Lampertheim', 49.5910, 8.4675, ARRAY['641'], FALSE, NULL, FALSE),
    ('stop-la-buerstaedter-str', 'Lampertheim Bürstädter Straße', 'Lampertheim', 49.5968, 8.4770, ARRAY['641'], FALSE, NULL, FALSE),
    ('stop-la-pestalozzi', 'Lampertheim Pestalozzischule', 'Lampertheim', 49.5945, 8.4740, ARRAY['641', '652'], TRUE, 'Pestalozzischule Grundschule', FALSE),
    ('stop-la-europabruecke', 'Lampertheim Europabrücke / B44', 'Lampertheim', 49.5890, 8.4660, ARRAY['644'], FALSE, NULL, FALSE),
    ('stop-la-wilhelmstr', 'Lampertheim Wilhelmstraße', 'Lampertheim', 49.5930, 8.4750, ARRAY['641'], FALSE, NULL, FALSE),
    ('stop-la-chemiestr', 'Lampertheim Chemiestraße', 'Lampertheim', 49.5960, 8.4590, ARRAY['641'], FALSE, NULL, FALSE),
    ('stop-la-falterweg', 'Lampertheim Falterweg', 'Lampertheim', 49.5970, 8.4690, ARRAY['641'], FALSE, NULL, FALSE),
    ('stop-la-worms-str', 'Lampertheim Wormser Straße (Ost)', 'Lampertheim', 49.5940, 8.4670, ARRAY['641'], FALSE, NULL, FALSE),
    ('stop-la-schlossplatz', 'Lampertheim-Neuschloß Schlossplatz', 'Lampertheim', 49.5985, 8.4950, ARRAY['641'], FALSE, NULL, FALSE),
    ('stop-la-ulmenweg', 'Lampertheim-Neuschloß Ulmenweg', 'Lampertheim', 49.5970, 8.4900, ARRAY['641'], FALSE, NULL, FALSE),
    ('stop-la-lindenweg', 'Lampertheim-Neuschloß Lindenweg', 'Lampertheim', 49.5980, 8.4870, ARRAY['641'], FALSE, NULL, FALSE),
    ('stop-la-huettenfeld-buergerhaus', 'Lampertheim-Hüttenfeld Bürgerhaus', 'Lampertheim', 49.5962, 8.5838, ARRAY['644'], FALSE, NULL, FALSE),
    ('stop-la-huettenfeld-litauer', 'Lampertheim-Hüttenfeld Litauersiedlung', 'Lampertheim', 49.5980, 8.5800, ARRAY['644'], FALSE, NULL, FALSE),

    -- Hofheim (Ried)
    ('stop-hof-bahnhof', 'Hofheim (Ried) Bahnhof', 'Hofheim (Ried)', 49.6588, 8.4115, ARRAY['642'], FALSE, NULL, TRUE),
    ('stop-hof-schule', 'Hofheim Schule / Sportpark', 'Hofheim (Ried)', 49.6580, 8.4175, ARRAY['642'], TRUE, 'Schule Hofheim Grundschule', FALSE),
    ('stop-hof-kirche', 'Hofheim Balthasar-Neumann-Kirche', 'Hofheim (Ried)', 49.6590, 8.4125, ARRAY['642'], FALSE, NULL, FALSE),
    ('stop-hof-buergerhaus', 'Hofheim Bürgerhaus / Rathaus', 'Hofheim (Ried)', 49.6575, 8.4140, ARRAY['642'], FALSE, NULL, FALSE),
    ('stop-hof-bibliser-weg', 'Hofheim Bibliser Weg', 'Hofheim (Ried)', 49.6615, 8.4135, ARRAY['642'], FALSE, NULL, FALSE),
    ('stop-hof-backhausstr', 'Hofheim Backhausstraße / Nordend', 'Hofheim (Ried)', 49.6630, 8.4160, ARRAY['642'], FALSE, NULL, FALSE),
    ('stop-hof-wormser-str', 'Hofheim Wormser Straße (Süd)', 'Hofheim (Ried)', 49.6540, 8.4150, ARRAY['642'], FALSE, NULL, FALSE),
    ('stop-hof-friedhof', 'Hofheim Friedhof', 'Hofheim (Ried)', 49.6600, 8.4180, ARRAY['642'], FALSE, NULL, FALSE),
    ('stop-hof-riedstr', 'Hofheim Riedstraße', 'Hofheim (Ried)', 49.6480, 8.4320, ARRAY['642'], FALSE, NULL, FALSE),

    -- Biblis
    ('stop-bib-bahnhof', 'Biblis Bahnhof (ZOB)', 'Biblis', 49.6886, 8.4485, ARRAY['644'], FALSE, NULL, TRUE),
    ('stop-bib-rathaus', 'Biblis Rathaus / Darmstädter Straße', 'Biblis', 49.6885, 8.4460, ARRAY['644'], FALSE, NULL, FALSE),
    ('stop-bib-schule', 'Biblis Schule am Weschnitzdamm', 'Biblis', 49.6835, 8.4445, ARRAY['644'], TRUE, 'Schule am Weschnitzdamm (Grundschule)', FALSE),
    ('stop-bib-kirchstr', 'Biblis Kirchstraße / Seepromenade', 'Biblis', 49.6820, 8.4440, ARRAY['644'], FALSE, NULL, FALSE),
    ('stop-bib-hintergasse', 'Biblis Hintergasse', 'Biblis', 49.6860, 8.4410, ARRAY['644'], FALSE, NULL, FALSE),
    ('stop-bib-buergerzentrum', 'Biblis Bürgerzentrum', 'Biblis', 49.6875, 8.4430, ARRAY['644'], FALSE, NULL, FALSE),
    ('stop-bib-pfaffenau', 'Biblis Pfaffenau', 'Biblis', 49.6895, 8.4500, ARRAY['644'], FALSE, NULL, FALSE),
    ('stop-bib-wasserwerk', 'Biblis Am Werrtor / Wertstoffhof', 'Biblis', 49.6912, 8.4420, ARRAY['644'], FALSE, NULL, FALSE),

    -- Wattenheim (Ortsteil Biblis)
    ('stop-wat-rheinstr', 'Wattenheim Rheinstraße', 'Biblis', 49.6940, 8.4280, ARRAY['644'], FALSE, NULL, FALSE),
    ('stop-wat-ortsmitte', 'Wattenheim Ortsmitte / Kirche', 'Biblis', 49.6970, 8.4230, ARRAY['644'], FALSE, NULL, FALSE),
    ('stop-wat-rheinufer', 'Wattenheim Rheinuferstraße', 'Biblis', 49.6950, 8.4200, ARRAY['644'], FALSE, NULL, FALSE),

    -- Nordheim (Ortsteil Biblis)
    ('stop-nor-rathaus', 'Nordheim Rathaus / Backhaus', 'Biblis', 49.6840, 8.3950, ARRAY['644'], FALSE, NULL, FALSE),
    ('stop-nor-rheinstr', 'Nordheim Rheinstraße', 'Biblis', 49.6860, 8.3920, ARRAY['644'], FALSE, NULL, FALSE),
    ('stop-nor-burg-stein', 'Nordheim Burg Stein / Steiner Wald', 'Biblis', 49.6880, 8.3880, ARRAY['644'], FALSE, NULL, FALSE),

    -- Groß-Rohrheim
    ('stop-gr-bahnhof', 'Groß-Rohrheim Bahnhof', 'Groß-Rohrheim', 49.7150, 8.4780, ARRAY['644'], FALSE, NULL, TRUE),
    ('stop-gr-buergerhalle', 'Groß-Rohrheim Bürgerhalle', 'Groß-Rohrheim', 49.7170, 8.4800, ARRAY['644'], FALSE, NULL, FALSE),
    ('stop-gr-rathaus', 'Groß-Rohrheim Rathaus', 'Groß-Rohrheim', 49.7190, 8.4820, ARRAY['644'], FALSE, NULL, FALSE),
    ('stop-gr-friedhof', 'Groß-Rohrheim Friedhof', 'Groß-Rohrheim', 49.7210, 8.4840, ARRAY['644'], FALSE, NULL, FALSE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    municipality = EXCLUDED.municipality,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    lines = EXCLUDED.lines,
    is_school_stop = EXCLUDED.is_school_stop,
    nearby_school_name = EXCLUDED.nearby_school_name,
    is_train_hub = EXCLUDED.is_train_hub;



