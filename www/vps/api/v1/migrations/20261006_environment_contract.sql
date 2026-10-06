-- Versioned scalar contract for new environmental/energy adapters.
-- Forecast runs belong to definition identity, keeping the existing core intact.
CREATE OR REPLACE FUNCTION write_environment_measurement(
    p_entity TEXT, p_metric TEXT, p_unit TEXT, p_source TEXT, p_kind TEXT,
    p_dimensions JSONB, p_time TIMESTAMPTZ, p_value NUMERIC,
    p_attempt BIGINT, p_metadata JSONB,
    p_quality TEXT DEFAULT 'valid', p_start TIMESTAMPTZ DEFAULT NULL,
    p_end TIMESTAMPTZ DEFAULT NULL, p_semantics TEXT DEFAULT 'instantaneous',
    p_issued TIMESTAMPTZ DEFAULT NULL
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE receipt collection_attempts%ROWTYPE; dims JSONB; evidence JSONB; basis TEXT;
BEGIN
    IF p_kind IS NULL OR p_kind NOT IN ('observation','model','forecast','derived') THEN
        RAISE EXCEPTION 'Unknown data kind' USING ERRCODE='23514';
    END IF;
    IF p_dimensions IS NULL OR jsonb_typeof(p_dimensions)<>'object'
        OR p_dimensions ?| ARRAY['contract','data_kind','issued_at'] THEN
        RAISE EXCEPTION 'Invalid or reserved dimensions' USING ERRCODE='23514';
    END IF;
    IF p_metadata IS NULL OR jsonb_typeof(p_metadata)<>'object'
        OR COALESCE(length(trim(p_metadata->>'license')),0)=0
        OR COALESCE(length(trim(p_metadata->>'spatial_reference')),0)=0
        OR (p_kind IN ('model','forecast') AND COALESCE(length(trim(p_metadata->>'model')),0)=0)
        OR (p_kind='derived' AND COALESCE(length(trim(p_metadata->>'method')),0)=0) THEN
        RAISE EXCEPTION 'License, spatial reference and model/method required' USING ERRCODE='23514';
    END IF;
    IF (p_kind='forecast' AND (p_issued IS NULL OR NOT isfinite(p_issued)))
        OR (p_kind<>'forecast' AND p_issued IS NOT NULL) THEN
        RAISE EXCEPTION 'Forecasts require an explicit issue time only' USING ERRCODE='23514';
    END IF;
    SELECT a.* INTO receipt FROM collection_attempts a
        JOIN collected_payloads p ON p.sha256=a.payload_sha256
        WHERE a.id=p_attempt AND a.source_id=p_source
        AND a.http_status BETWEEN 200 AND 299 AND a.status IN ('received','success');
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Successful archived source receipt required' USING ERRCODE='23514';
    END IF;
    IF p_issued IS NOT NULL AND p_issued>receipt.received_at THEN
        RAISE EXCEPTION 'Issue time exceeds receipt time' USING ERRCODE='23514';
    END IF;
    dims := p_dimensions || jsonb_build_object('contract','environment-v1','data_kind',p_kind);
    IF p_issued IS NOT NULL THEN
        dims := dims || jsonb_build_object('issued_at',
            to_char(p_issued AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
    END IF;
    evidence := p_metadata || jsonb_build_object('attempt_id',receipt.id,
        'payload_sha256',receipt.payload_sha256,'data_kind',p_kind,'issued_at',p_issued);
    basis := CASE WHEN p_kind='observation' THEN 'observed' ELSE 'model' END;
    RETURN write_measurement(p_entity,p_metric,p_unit,p_source,basis,dims,p_time,p_value,
        receipt.received_at,evidence,p_quality,p_start,p_end,p_semantics);
END $$;
