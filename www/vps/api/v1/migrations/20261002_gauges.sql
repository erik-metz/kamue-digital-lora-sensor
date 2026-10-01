CREATE OR REPLACE FUNCTION mirror_gauge_publication(p_row collected_datasets)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE item RECORD; gauge JSONB; entity_key TEXT; template_value JSONB; matches INTEGER;
    is_map BOOLEAN; sample_time TIMESTAMPTZ; metric_name TEXT; source_field TEXT;
    unit_name TEXT; definition BIGINT; numeric_value NUMERIC; quality_name TEXT; scalar_path TEXT[];
BEGIN
    IF p_row.dataset NOT IN ('environment/flood/gauges','map/layers/floods') THEN RETURN; END IF;
    IF p_row.source_id <> 'environment-pegel' THEN RAISE EXCEPTION 'Unsupported gauge source'; END IF;
    is_map:=p_row.dataset='map/layers/floods'; template_value:=p_row.data;
    INSERT INTO measurement_publications VALUES(p_row.dataset,p_row.payload_sha256,p_row.source_updated_at,p_row.data)
    ON CONFLICT(dataset) DO UPDATE SET payload_sha256=EXCLUDED.payload_sha256,
        source_updated_at=EXCLUDED.source_updated_at,template=EXCLUDED.template;
    DELETE FROM measurement_publication_cells WHERE dataset=p_row.dataset;
    FOR item IN SELECT value,ordinality FROM jsonb_array_elements(
        CASE WHEN is_map THEN p_row.data->'features' ELSE p_row.data END) WITH ORDINALITY LOOP
        IF is_map THEN
            -- Older map publications lack a station ID. Resolve only an exact,
            -- unique match in the associated source publication; never guess by name alone.
            SELECT count(*),(jsonb_agg(g.value))->0 INTO matches,gauge
            FROM collected_datasets d CROSS JOIN LATERAL jsonb_array_elements(d.data) g
            WHERE d.dataset='environment/flood/gauges' AND d.source_id=p_row.source_id
                AND d.payload_sha256=p_row.payload_sha256
                AND g.value->>'name'=item.value->'properties'->>'name'
                AND (g.value->>'updated_at')::timestamptz=(item.value->'properties'->>'measured_at')::timestamptz
                AND g.value->'longitude'=item.value#>'{geometry,coordinates,0}'
                AND g.value->'latitude'=item.value#>'{geometry,coordinates,1}'
                AND g.value->'current_level_m'=item.value#>'{properties,level_m}';
            IF matches <> 1 THEN RAISE EXCEPTION 'Gauge map feature has no unique source station'; END IF;
        ELSE gauge:=item.value; END IF;
        IF COALESCE(gauge->>'id','')='' THEN RAISE EXCEPTION 'Missing gauge identity'; END IF;
        entity_key:='water-gauge:'||(gauge->>'id'); sample_time:=(gauge->>'updated_at')::timestamptz;
        INSERT INTO entities(id,name,entity_type,metadata)
        VALUES(entity_key,gauge->>'name','water_gauge',gauge-ARRAY['latitude','longitude','current_level_m'])
        ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,metadata=EXCLUDED.metadata,updated_at=NOW();
        FOREACH source_field IN ARRAY ARRAY['latitude','longitude','current_level_m'] LOOP
            metric_name:=CASE WHEN source_field='current_level_m' THEN 'water_level' ELSE source_field END;
            unit_name:=CASE WHEN source_field='current_level_m' THEN 'm' ELSE 'degrees' END;
            IF jsonb_typeof(gauge->source_field)='number' THEN
                numeric_value:=(gauge->>source_field)::numeric; quality_name:='valid';
            ELSIF jsonb_typeof(gauge->source_field)='null' THEN
                numeric_value:=NULL; quality_name:='missing';
            ELSE RAISE EXCEPTION 'Invalid gauge numeric field: %',source_field; END IF;
            definition:=write_measurement(entity_key,metric_name,unit_name,p_row.source_id,
                CASE WHEN source_field='current_level_m' THEN 'observed' ELSE 'reported' END,
                CASE WHEN source_field='current_level_m' THEN '{"datum":"source_defined"}'::jsonb ELSE '{"crs":"EPSG:4326"}'::jsonb END,
                sample_time,numeric_value,p_row.fetched_at,
                jsonb_build_object('payload_sha256',p_row.payload_sha256,'source_station_id',gauge->>'source_station_id',
                    'time_basis',CASE WHEN source_field='current_level_m' THEN 'provider_observation' ELSE 'inventory_effective_time' END),
                quality_name,NULL,NULL,CASE WHEN source_field='current_level_m' THEN 'instantaneous' ELSE 'reference' END);
            IF is_map THEN
                scalar_path:=ARRAY['features',(item.ordinality-1)::text]||CASE source_field
                    WHEN 'latitude' THEN ARRAY['geometry','coordinates','1']
                    WHEN 'longitude' THEN ARRAY['geometry','coordinates','0'] ELSE ARRAY['properties','level_m'] END;
            ELSE scalar_path:=ARRAY[(item.ordinality-1)::text,source_field]; END IF;
            INSERT INTO measurement_publication_cells VALUES(p_row.dataset,scalar_path,definition,sample_time);
            template_value:=jsonb_set(template_value,scalar_path,'null'::jsonb,FALSE);
        END LOOP;
    END LOOP;
    UPDATE measurement_publications SET template=template_value WHERE dataset=p_row.dataset;
END $$;

CREATE OR REPLACE FUNCTION read_gauge_publication(p_dataset TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE result JSONB; cell RECORD; expected_count INTEGER; actual_count INTEGER;
BEGIN
    SELECT template INTO STRICT result FROM measurement_publications WHERE dataset=p_dataset;
    expected_count:=3*jsonb_array_length(CASE WHEN p_dataset='map/layers/floods' THEN result->'features' ELSE result END);
    SELECT count(*) INTO actual_count FROM measurement_publication_cells WHERE dataset=p_dataset;
    IF actual_count<>expected_count THEN RAISE EXCEPTION 'Missing canonical gauge binding: %',p_dataset; END IF;
    FOR cell IN SELECT c.path,r.value,r.measurement_id FROM measurement_publication_cells c
        LEFT JOIN readings r ON r.measurement_id=c.measurement_id AND r.observed_at=c.observed_at WHERE c.dataset=p_dataset LOOP
        IF cell.measurement_id IS NULL THEN RAISE EXCEPTION 'Missing canonical gauge reading: %',p_dataset; END IF;
        result:=jsonb_set(result,cell.path,COALESCE(to_jsonb(cell.value),'null'::jsonb),FALSE);
    END LOOP;
    RETURN result;
END $$;

CREATE OR REPLACE FUNCTION shadow_gauge_publication() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    PERFORM mirror_gauge_publication(NEW);
    RETURN NULL;
END $$;

CREATE OR REPLACE VIEW core_gauge_datasets AS
SELECT d.dataset,d.source_id,d.source_url,d.source_updated_at,d.fetched_at,d.expires_at,d.payload_sha256,
    read_gauge_publication(d.dataset) AS data
FROM collected_datasets d JOIN measurement_publications p USING(dataset)
WHERE d.dataset IN ('environment/flood/gauges','map/layers/floods')
    AND d.payload_sha256=p.payload_sha256 AND d.source_updated_at=p.source_updated_at;

CREATE OR REPLACE VIEW core_map_datasets AS
SELECT dataset,data,expires_at FROM collected_datasets WHERE dataset NOT IN ('map/layers/charging','map/layers/floods')
UNION ALL
SELECT dataset,data,expires_at FROM core_charger_datasets WHERE dataset='map/layers/charging'
UNION ALL
SELECT dataset,data,expires_at FROM core_gauge_datasets WHERE dataset='map/layers/floods';
