-- Explicit opt-in after core installation. Keeps legacy and core writes atomic.
-- Reading APIs continue using legacy tables until parity has been reviewed.
CREATE OR REPLACE FUNCTION mirror_sensor_metadata(p_row sensor_metadata)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE effective_time TIMESTAMPTZ;
BEGIN
    INSERT INTO entities(id,name,entity_type,metadata,is_hidden)
    VALUES ('sensor:'||p_row.id,p_row.friendly_name,'sensor',
        jsonb_build_object('legacy_sensor_id',p_row.id,'description',p_row.description,
            'has_latitude',p_row.latitude IS NOT NULL,'has_longitude',p_row.longitude IS NOT NULL,
            'source_created_at',p_row.created_at,'source_updated_at',p_row.updated_at),p_row.is_hidden)
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,metadata=EXCLUDED.metadata,
        is_hidden=EXCLUDED.is_hidden,updated_at=NOW()
    WHERE (entities.name,entities.metadata,entities.is_hidden)
        IS DISTINCT FROM (EXCLUDED.name,EXCLUDED.metadata,EXCLUDED.is_hidden);
    effective_time := COALESCE(p_row.updated_at,p_row.created_at,NOW());
    IF p_row.latitude IS NOT NULL THEN
        PERFORM write_measurement('sensor:'||p_row.id,'latitude','degrees','sensor-inventory',
            'unknown','{"crs":"EPSG:4326"}',effective_time,legacy_numeric(p_row.latitude),NOW(),
            '{"legacy_table":"sensor_metadata","time_basis":"metadata_effective_time"}',
            'valid',NULL,NULL,'reference');
    END IF;
    IF p_row.longitude IS NOT NULL THEN
        PERFORM write_measurement('sensor:'||p_row.id,'longitude','degrees','sensor-inventory',
            'unknown','{"crs":"EPSG:4326"}',effective_time,legacy_numeric(p_row.longitude),NOW(),
            '{"legacy_table":"sensor_metadata","time_basis":"metadata_effective_time"}',
            'valid',NULL,NULL,'reference');
    END IF;
END $$;

CREATE OR REPLACE FUNCTION shadow_sensor_metadata_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE entities SET is_hidden=TRUE, updated_at=NOW(),
            metadata=metadata||'{"legacy_deleted":true}' WHERE id='sensor:'||OLD.id;
    ELSE
        IF TG_OP = 'UPDATE' AND NEW.id <> OLD.id THEN
            RAISE EXCEPTION 'Sensor identity changes require an explicit migration while shadow writes are enabled';
        END IF;
        PERFORM mirror_sensor_metadata(NEW);
    END IF;
    RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION mirror_sensor_reading(
    p_sensor TEXT, p_metric TEXT, p_unit TEXT, p_time TIMESTAMPTZ,
    p_value NUMERIC, p_backfill BOOLEAN DEFAULT FALSE
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE meta sensor_metadata%ROWTYPE;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM entities WHERE id='sensor:'||p_sensor) THEN
        SELECT * INTO STRICT meta FROM sensor_metadata WHERE id=p_sensor;
        PERFORM mirror_sensor_metadata(meta);
    END IF;
    -- Legacy telemetry does not uniformly record source or observation basis.
    -- Preserve that uncertainty instead of labelling model values as measured.
    PERFORM write_measurement('sensor:'||p_sensor,p_metric,p_unit,'legacy-sensor:'||p_sensor,
        'unknown','{}',p_time,p_value,NOW(),'{"legacy_table":"sensor_data","basis_unverified":true}',
        'valid',NULL,NULL,'unknown',p_backfill);
END $$;

CREATE OR REPLACE FUNCTION reconcile_shadow_sensor_key(
    p_sensor TEXT,p_metric TEXT,p_unit TEXT,p_time TIMESTAMPTZ
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE variants BIGINT; remaining NUMERIC;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(
        jsonb_build_array(p_sensor,p_metric,p_unit,extract(epoch FROM p_time))::text,20260930));
    SELECT COUNT(DISTINCT value),MIN(legacy_numeric(value)) INTO variants,remaining
    FROM sensor_data WHERE sensor_id=p_sensor AND metric=p_metric AND unit=p_unit AND timestamp=p_time;
    IF variants > 1 THEN
        IF reconcile_weather_history(p_sensor,p_metric,p_unit,p_time) THEN RETURN; END IF;
        RAISE EXCEPTION 'Conflicting legacy samples for %/% at %',p_sensor,p_metric,p_time;
    ELSIF variants = 1 THEN
        PERFORM mirror_sensor_reading(p_sensor,p_metric,p_unit,p_time,remaining);
    ELSE
        DELETE FROM readings r USING measurement_definitions d
        WHERE r.measurement_id=d.id AND d.entity_id='sensor:'||p_sensor
          AND d.source_id='legacy-sensor:'||p_sensor AND d.basis='unknown'
          AND d.metric=p_metric AND d.unit=p_unit AND r.observed_at=p_time;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION shadow_sensor_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Removal/reidentification must be reconciled before enabling shadow storage.
    IF TG_OP = 'UPDATE' AND (OLD.sensor_id,OLD.metric,OLD.unit,OLD.timestamp)
        IS DISTINCT FROM (NEW.sensor_id,NEW.metric,NEW.unit,NEW.timestamp) THEN
        PERFORM reconcile_shadow_sensor_key(OLD.sensor_id,OLD.metric,OLD.unit,OLD.timestamp);
    END IF;
    IF TG_OP = 'DELETE' THEN
        PERFORM reconcile_shadow_sensor_key(OLD.sensor_id,OLD.metric,OLD.unit,OLD.timestamp);
    ELSE
        PERFORM reconcile_shadow_sensor_key(NEW.sensor_id,NEW.metric,NEW.unit,NEW.timestamp);
    END IF;
    RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION mirror_movement_reading(
    p_row movement_positions, p_backfill BOOLEAN DEFAULT FALSE
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE evidence JSONB;
BEGIN
    INSERT INTO entities(id,name,entity_type,metadata)
    VALUES ('movement:'||p_row.entity_id,p_row.entity_id,
        CASE WHEN p_row.basis='schedule_prediction' THEN 'service_trip' ELSE p_row.kind END,
        jsonb_build_object('legacy_movement_id',p_row.entity_id,'kind',p_row.kind))
    ON CONFLICT (id) DO NOTHING;
    evidence := jsonb_build_object('legacy_table','movement_positions',
        'payload_sha256',p_row.payload_sha256,'model_version',p_row.model_version);
    PERFORM write_measurement('movement:'||p_row.entity_id,'latitude','degrees',p_row.source_id,
        p_row.basis,'{"crs":"EPSG:4326"}',p_row.timestamp,legacy_numeric(p_row.latitude),NOW(),evidence,
        'valid',NULL,NULL,'instantaneous',p_backfill);
    PERFORM write_measurement('movement:'||p_row.entity_id,'longitude','degrees',p_row.source_id,
        p_row.basis,'{"crs":"EPSG:4326"}',p_row.timestamp,legacy_numeric(p_row.longitude),NOW(),evidence,
        'valid',NULL,NULL,'instantaneous',p_backfill);
    IF jsonb_typeof(p_row.metadata->'speed_kmh') = 'number' THEN
        PERFORM write_measurement('movement:'||p_row.entity_id,'speed','km/h',p_row.source_id,
            p_row.basis,'{}',p_row.timestamp,(p_row.metadata->>'speed_kmh')::numeric,NOW(),evidence,
            'valid',NULL,NULL,'instantaneous',p_backfill);
    END IF;
    IF jsonb_typeof(p_row.metadata->'delay_seconds') = 'number' THEN
        PERFORM write_measurement('movement:'||p_row.entity_id,'delay','s',p_row.source_id,
            p_row.basis,'{}',p_row.timestamp,(p_row.metadata->>'delay_seconds')::numeric,NOW(),evidence,
            'valid',NULL,NULL,'instantaneous',p_backfill);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION shadow_movement_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        IF TG_OP = 'DELETE' OR (OLD.timestamp,OLD.entity_id,OLD.basis,OLD.source_id)
            IS DISTINCT FROM (NEW.timestamp,NEW.entity_id,NEW.basis,NEW.source_id) THEN
            DELETE FROM readings r USING measurement_definitions d
            WHERE r.measurement_id=d.id AND d.entity_id='movement:'||OLD.entity_id
                AND d.source_id=OLD.source_id AND d.basis=OLD.basis AND r.observed_at=OLD.timestamp;
        END IF;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        PERFORM mirror_movement_reading(NEW);
    END IF;
    RETURN NULL;
END $$;

CREATE OR REPLACE TRIGGER measurement_shadow_sensor AFTER INSERT OR UPDATE OR DELETE ON sensor_data
FOR EACH ROW EXECUTE FUNCTION shadow_sensor_change();
CREATE OR REPLACE TRIGGER measurement_shadow_metadata AFTER INSERT OR UPDATE OR DELETE ON sensor_metadata
FOR EACH ROW EXECUTE FUNCTION shadow_sensor_metadata_change();
CREATE OR REPLACE TRIGGER measurement_shadow_movement AFTER INSERT OR UPDATE OR DELETE ON movement_positions
FOR EACH ROW EXECUTE FUNCTION shadow_movement_change();

CREATE OR REPLACE TRIGGER measurement_shadow_statistics AFTER INSERT OR UPDATE ON collected_datasets
FOR EACH ROW WHEN (NEW.dataset LIKE 'statistics/%') EXECUTE FUNCTION shadow_statistical_publication();

CREATE OR REPLACE TRIGGER measurement_shadow_chargers AFTER INSERT OR UPDATE ON collected_datasets
FOR EACH ROW WHEN (NEW.dataset IN ('infrastructure/ev-charging','map/layers/charging'))
EXECUTE FUNCTION shadow_charger_publication();

CREATE OR REPLACE TRIGGER measurement_shadow_gauges AFTER INSERT OR UPDATE ON collected_datasets
FOR EACH ROW WHEN (NEW.dataset IN ('environment/flood/gauges','map/layers/floods'))
EXECUTE FUNCTION shadow_gauge_publication();

-- Bounded server-side loops preserve per-key row locking without two client
-- round trips for every historical reading. The caller owns the transaction
-- and advances its checkpoint only after this entire batch succeeds.
CREATE OR REPLACE FUNCTION backfill_sensor_samples(p_keys JSONB)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE item RECORD; low_value NUMERIC; high_value NUMERIC;
BEGIN
    IF jsonb_array_length(p_keys)>10000 THEN RAISE EXCEPTION 'Backfill batch too large'; END IF;
    FOR item IN SELECT * FROM jsonb_to_recordset(p_keys)
        AS k(observed_at TIMESTAMPTZ,sensor_id TEXT,metric TEXT,unit TEXT) LOOP
        SELECT MIN(legacy_numeric(value)),MAX(legacy_numeric(value)) INTO low_value,high_value
        FROM (SELECT value FROM sensor_data WHERE timestamp=item.observed_at AND sensor_id=item.sensor_id
            AND metric=item.metric AND unit=item.unit FOR SHARE) locked;
        IF low_value IS DISTINCT FROM high_value THEN
            IF reconcile_weather_history(item.sensor_id,item.metric,item.unit,item.observed_at) THEN
                CONTINUE;
            END IF;
            RAISE EXCEPTION 'Conflicting legacy readings: %/% at %',item.sensor_id,item.metric,item.observed_at
                USING ERRCODE='21000';
        END IF;
        IF low_value IS NOT NULL THEN
            PERFORM mirror_sensor_reading(item.sensor_id,item.metric,item.unit,item.observed_at,low_value,TRUE);
        END IF;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION backfill_movement_samples(p_keys JSONB)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE item RECORD; position movement_positions%ROWTYPE;
BEGIN
    IF jsonb_array_length(p_keys)>10000 THEN RAISE EXCEPTION 'Backfill batch too large'; END IF;
    FOR item IN SELECT * FROM jsonb_to_recordset(p_keys)
        AS k(observed_at TIMESTAMPTZ,entity_id TEXT,basis TEXT) LOOP
        SELECT * INTO position FROM movement_positions WHERE timestamp=item.observed_at
            AND entity_id=item.entity_id AND basis=item.basis FOR SHARE;
        IF FOUND THEN PERFORM mirror_movement_reading(position,TRUE); END IF;
    END LOOP;
END $$;
INSERT INTO measurement_migration_state(name,state) VALUES ('shadow_writes','{"enabled":true}')
ON CONFLICT (name) DO UPDATE SET state=EXCLUDED.state, updated_at=NOW();

CREATE OR REPLACE TRIGGER measurement_shadow_coordinates AFTER INSERT OR UPDATE ON collected_datasets
FOR EACH ROW EXECUTE FUNCTION shadow_coordinate_publication();
