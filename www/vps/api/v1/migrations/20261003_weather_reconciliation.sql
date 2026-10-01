-- Resolve legacy duplicates only when every value survives in the source-aware
-- model stream or its revision history. Unexplained values still stop migration.
CREATE OR REPLACE FUNCTION weather_history_explained(
    p_sensor TEXT,p_metric TEXT,p_unit TEXT,p_time TIMESTAMPTZ
) RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE chosen readings%ROWTYPE; definition_id BIGINT;
BEGIN
    IF p_sensor <> 'weather-dwd-ried' THEN RETURN FALSE; END IF;
    SELECT id INTO definition_id FROM measurement_definitions
    WHERE entity_id='sensor:'||p_sensor AND source_id='environment-weather'
        AND basis='model' AND dimensions='{}' AND metric=p_metric AND unit=p_unit;
    SELECT * INTO chosen FROM readings WHERE measurement_id=definition_id
        AND observed_at=p_time AND quality='valid';
    IF NOT FOUND THEN RETURN FALSE; END IF;
    IF EXISTS (
        SELECT 1 FROM sensor_data s
        WHERE s.sensor_id=p_sensor AND s.metric=p_metric AND s.unit=p_unit AND s.timestamp=p_time
        AND NOT EXISTS (
            SELECT 1 FROM (
                SELECT r.value,r.provenance FROM readings r
                WHERE r.measurement_id=definition_id AND r.observed_at=p_time
                UNION ALL
                SELECT (v.previous_record->>'value')::numeric,v.previous_record->'provenance'
                FROM reading_revisions v WHERE v.measurement_id=definition_id AND v.observed_at=p_time
            ) evidence JOIN collection_attempts a
                ON a.id=(evidence.provenance->>'collection_attempt_id')::bigint
                AND a.payload_sha256=evidence.provenance->>'payload_sha256'
                AND a.source_id='environment-weather' AND a.http_status=200
                AND a.status IN ('received','success')
            WHERE evidence.value=legacy_numeric(s.value)
        )
    ) THEN RETURN FALSE; END IF;
    RETURN TRUE;
END $$;

CREATE OR REPLACE FUNCTION reconcile_weather_history(
    p_sensor TEXT,p_metric TEXT,p_unit TEXT,p_time TIMESTAMPTZ
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE chosen readings%ROWTYPE;
BEGIN
    IF NOT weather_history_explained(p_sensor,p_metric,p_unit,p_time) THEN RETURN FALSE; END IF;
    SELECT r.* INTO STRICT chosen FROM readings r JOIN measurement_definitions d ON d.id=r.measurement_id
    WHERE d.entity_id='sensor:'||p_sensor AND d.source_id='environment-weather' AND d.basis='model'
        AND d.dimensions='{}' AND d.metric=p_metric AND d.unit=p_unit AND r.observed_at=p_time;
    -- Keep the compatibility stream consistent until its explicit read cutover.
    -- The source-aware stream retains model classification and every correction.
    PERFORM write_measurement('sensor:'||p_sensor,p_metric,p_unit,'legacy-sensor:'||p_sensor,
        'unknown','{}',p_time,chosen.value,NOW(),
        chosen.provenance||jsonb_build_object('legacy_reconciled',true,
            'source_received_at',chosen.collected_at), 'valid',NULL,NULL,'unknown');
    RETURN TRUE;
END $$;
