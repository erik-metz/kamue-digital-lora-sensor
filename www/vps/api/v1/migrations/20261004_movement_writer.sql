-- Deduplicated descriptive context; position, speed and delay remain readings.
CREATE TABLE IF NOT EXISTS movement_contexts (
    id TEXT PRIMARY KEY,
    metadata JSONB NOT NULL
);

CREATE OR REPLACE FUNCTION movement_context_id(p_metadata JSONB)
RETURNS TEXT LANGUAGE SQL IMMUTABLE STRICT AS $$
    SELECT encode(sha256(convert_to((p_metadata-ARRAY['speed_kmh','delay_seconds'])::text,'UTF8')),'hex')
$$;

CREATE OR REPLACE FUNCTION write_movement_position(p_data JSONB,p_backfill BOOLEAN DEFAULT FALSE)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE entity_key TEXT:='movement:'||(p_data->>'entity_id');
    sample_time TIMESTAMPTZ:=(p_data->>'timestamp')::timestamptz;
    metadata_value JSONB:=p_data->'metadata'; context_key TEXT; evidence JSONB;
BEGIN
    IF p_data->>'basis' NOT IN ('observed','schedule_prediction')
        OR p_data->>'kind' NOT IN ('bus','train','waste') THEN RAISE EXCEPTION 'Unsupported movement identity'; END IF;
    INSERT INTO entities(id,name,entity_type,metadata)
    VALUES(entity_key,p_data->>'entity_id',CASE WHEN p_data->>'basis'='schedule_prediction'
        THEN 'service_trip' ELSE p_data->>'kind' END,
        jsonb_build_object('legacy_movement_id',p_data->>'entity_id','kind',p_data->>'kind'))
    ON CONFLICT(id) DO NOTHING;
    context_key:=movement_context_id(metadata_value);
    INSERT INTO movement_contexts VALUES(context_key,metadata_value-ARRAY['speed_kmh','delay_seconds']) ON CONFLICT DO NOTHING;
    evidence:=jsonb_build_object('payload_sha256',p_data->>'payload_sha256',
        'model_version',p_data->>'model_version','context_id',context_key,'kind',p_data->>'kind');
    PERFORM write_measurement(entity_key,'latitude','degrees',p_data->>'source_id',p_data->>'basis',
        '{"crs":"EPSG:4326"}',sample_time,(p_data->>'latitude')::numeric,NOW(),evidence,
        'valid',NULL,NULL,'instantaneous',p_backfill);
    PERFORM write_measurement(entity_key,'longitude','degrees',p_data->>'source_id',p_data->>'basis',
        '{"crs":"EPSG:4326"}',sample_time,(p_data->>'longitude')::numeric,NOW(),evidence,
        'valid',NULL,NULL,'instantaneous',p_backfill);
    IF jsonb_typeof(metadata_value->'speed_kmh')='number' THEN
        PERFORM write_measurement(entity_key,'speed','km/h',p_data->>'source_id',p_data->>'basis','{}',
            sample_time,(metadata_value->>'speed_kmh')::numeric,NOW(),evidence,'valid',NULL,NULL,'instantaneous',p_backfill);
    END IF;
    IF jsonb_typeof(metadata_value->'delay_seconds')='number' THEN
        PERFORM write_measurement(entity_key,'delay','s',p_data->>'source_id',p_data->>'basis','{}',
            sample_time,(metadata_value->>'delay_seconds')::numeric,NOW(),evidence,'valid',NULL,NULL,'instantaneous',p_backfill);
    END IF;
END $$;
