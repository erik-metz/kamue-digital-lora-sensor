-- A bounded interval is materialized once, then inserted as a set. This avoids
-- rescanning compressed source partitions for every historical timestamp.
CREATE OR REPLACE FUNCTION backfill_measurement_window(p_family TEXT,p_start TIMESTAMPTZ,p_end TIMESTAMPTZ)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE conflict RECORD; total BIGINT;
BEGIN
    IF p_end<=p_start OR p_end-p_start>INTERVAL '1 hour' THEN RAISE EXCEPTION 'Invalid history window'; END IF;
    PERFORM pg_advisory_xact_lock(2026093001);
    CREATE TEMP TABLE migration_window (
        entity_id TEXT,metric TEXT,unit TEXT,source_id TEXT,basis TEXT,dimensions JSONB,
        semantics TEXT,observed_at TIMESTAMPTZ,value NUMERIC,provenance JSONB
    ) ON COMMIT DROP;
    IF p_family='sensors' THEN
        FOR conflict IN SELECT sensor_id,metric,unit,timestamp FROM sensor_data
            WHERE timestamp>=p_start AND timestamp<p_end GROUP BY sensor_id,metric,unit,timestamp
            HAVING count(DISTINCT value)>1 LOOP
            IF NOT reconcile_weather_history(conflict.sensor_id,conflict.metric,conflict.unit,conflict.timestamp) THEN
                RAISE EXCEPTION 'Unexplained history conflict: %/% at %',conflict.sensor_id,conflict.metric,conflict.timestamp;
            END IF;
        END LOOP;
        INSERT INTO migration_window
        SELECT 'sensor:'||sensor_id,metric,unit,'legacy-sensor:'||sensor_id,'unknown','{}','unknown',timestamp,
            CASE WHEN count(DISTINCT value)>1 THEN (
                SELECT r.value FROM readings r JOIN measurement_definitions d ON d.id=r.measurement_id
                WHERE d.entity_id='sensor:'||s.sensor_id AND d.source_id='environment-weather'
                    AND d.basis='model' AND d.dimensions='{}' AND d.metric=s.metric AND d.unit=s.unit
                    AND r.observed_at=s.timestamp
            ) ELSE min(legacy_numeric(value)) END,
            '{"legacy_table":"sensor_data","basis_unverified":true}'
        FROM sensor_data s WHERE timestamp>=p_start AND timestamp<p_end
        GROUP BY sensor_id,metric,unit,timestamp;
    ELSIF p_family='movements' THEN
        CREATE TEMP TABLE migration_positions ON COMMIT DROP AS
            SELECT * FROM movement_positions WHERE timestamp>=p_start AND timestamp<p_end;
        INSERT INTO movement_contexts(id,metadata)
        SELECT DISTINCT movement_context_id(metadata),metadata-ARRAY['speed_kmh','delay_seconds']
        FROM migration_positions ON CONFLICT DO NOTHING;
        INSERT INTO entities(id,name,entity_type,metadata)
        SELECT DISTINCT ON(entity_id) 'movement:'||entity_id,entity_id,
            CASE WHEN basis='schedule_prediction' THEN 'service_trip' ELSE kind END,
            jsonb_build_object('legacy_movement_id',entity_id,'kind',kind)
        FROM migration_positions ORDER BY entity_id,timestamp DESC ON CONFLICT(id) DO NOTHING;
        INSERT INTO migration_window
        SELECT 'movement:'||p.entity_id,v.metric,v.unit,p.source_id,p.basis,v.dimensions,
            'instantaneous',p.timestamp,v.value,
            jsonb_build_object('legacy_table','movement_positions','payload_sha256',p.payload_sha256,
                'model_version',p.model_version,'context_id',movement_context_id(p.metadata),'kind',p.kind)
        FROM migration_positions p CROSS JOIN LATERAL (VALUES
            ('latitude','degrees','{"crs":"EPSG:4326"}'::jsonb,legacy_numeric(p.latitude)),
            ('longitude','degrees','{"crs":"EPSG:4326"}'::jsonb,legacy_numeric(p.longitude)),
            ('speed','km/h','{}'::jsonb,CASE WHEN jsonb_typeof(p.metadata->'speed_kmh')='number' THEN (p.metadata->>'speed_kmh')::numeric END),
            ('delay','s','{}'::jsonb,CASE WHEN jsonb_typeof(p.metadata->'delay_seconds')='number' THEN (p.metadata->>'delay_seconds')::numeric END)
        ) v(metric,unit,dimensions,value) WHERE v.value IS NOT NULL;
    ELSE RAISE EXCEPTION 'Unknown history family'; END IF;
    SELECT count(*) INTO total FROM migration_window;
    IF total>100000 THEN RAISE EXCEPTION 'History window too large; use a shorter interval'; END IF;
    INSERT INTO measurement_definitions(entity_id,metric,unit,source_id,basis,dimensions,semantics)
    SELECT DISTINCT entity_id,metric,unit,source_id,basis,dimensions,semantics FROM migration_window
    ON CONFLICT(entity_id,metric,unit,source_id,basis,dimensions) DO NOTHING;
    INSERT INTO readings(measurement_id,observed_at,value,quality,collected_at,provenance)
    SELECT d.id,w.observed_at,w.value,'valid',NOW(),w.provenance
    FROM migration_window w JOIN measurement_definitions d USING(entity_id,metric,unit,source_id,basis,dimensions)
    ORDER BY d.id,w.observed_at ON CONFLICT(measurement_id,observed_at) DO NOTHING;
    IF p_family='movements' THEN
        -- Earlier shadow rows predate the descriptive-context helper. Preserve
        -- that context too before the legacy trajectory table is retired.
        UPDATE readings r SET provenance=r.provenance||w.provenance
        FROM migration_window w JOIN measurement_definitions d USING(entity_id,metric,unit,source_id,basis,dimensions)
        WHERE r.measurement_id=d.id AND r.observed_at=w.observed_at AND NOT r.provenance ? 'context_id';
    END IF;
    -- Store transfer progress in the same transaction as the copied values.
    INSERT INTO measurement_migration_state(name,state)
    VALUES ('window:'||p_family,jsonb_build_object('through',p_end,'last_window_samples',total))
    ON CONFLICT(name) DO UPDATE SET state=EXCLUDED.state,updated_at=NOW();
    RETURN total;
END $$;
