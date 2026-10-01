-- Inventory fields use the same scalar contract. Descriptions, classifications
-- and polygon/line geometry remain publication context.
CREATE OR REPLACE FUNCTION mirror_charger_publication(p_row collected_datasets)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE item RECORD; property RECORD; station JSONB; item_template JSONB;
    publication_template JSONB; items JSONB:='[]'; prefix TEXT[]; scalar_path TEXT[];
    entity_key TEXT; sample_time TIMESTAMPTZ; definition BIGINT; metric_name TEXT;
    unit_name TEXT; field_value JSONB; numeric_value NUMERIC; quality_name TEXT;
    is_map BOOLEAN; field_names TEXT[]:=ARRAY['lat','lng','totalPoints','maxPowerKw',
        'availablePoints','occupiedPoints','outOfServicePoints'];
BEGIN
    IF p_row.dataset NOT IN ('infrastructure/ev-charging','map/layers/charging') THEN RETURN; END IF;
    IF p_row.source_id <> 'bnetza-chargers' THEN RAISE EXCEPTION 'Unsupported charger source'; END IF;
    is_map:=p_row.dataset='map/layers/charging';
    publication_template:=p_row.data;
    INSERT INTO measurement_publications VALUES(p_row.dataset,p_row.payload_sha256,p_row.source_updated_at,p_row.data)
    ON CONFLICT(dataset) DO UPDATE SET payload_sha256=EXCLUDED.payload_sha256,
        source_updated_at=EXCLUDED.source_updated_at,template=EXCLUDED.template;
    DELETE FROM measurement_publication_cells WHERE dataset=p_row.dataset;
    FOR item IN SELECT value,ordinality FROM jsonb_array_elements(
        p_row.data->CASE WHEN is_map THEN 'features' ELSE 'stations' END) WITH ORDINALITY LOOP
        station:=CASE WHEN is_map THEN item.value->'properties' ELSE item.value END;
        IF COALESCE(station->>'id','')='' THEN RAISE EXCEPTION 'Missing charger identity'; END IF;
        IF jsonb_typeof(station->'lat') IS DISTINCT FROM 'number' OR jsonb_typeof(station->'lng') IS DISTINCT FROM 'number' THEN
            RAISE EXCEPTION 'Charger inventory requires a complete coordinate pair';
        END IF;
        entity_key:='charger:'||(station->>'id');
        sample_time:=COALESCE((station->>'sourceUpdatedAt')::timestamptz,p_row.source_updated_at);
        INSERT INTO entities(id,name,entity_type,metadata) VALUES(entity_key,station->>'name','charging_station',station-field_names)
        ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,metadata=entities.metadata||EXCLUDED.metadata,updated_at=NOW();
        prefix:=ARRAY[CASE WHEN is_map THEN 'features' ELSE 'stations' END,(item.ordinality-1)::text];
        item_template:=item.value;
        FOR property IN SELECT key,value FROM jsonb_each(station) WHERE key=ANY(field_names) LOOP
            metric_name:=CASE property.key WHEN 'lat' THEN 'latitude' WHEN 'lng' THEN 'longitude'
                WHEN 'totalPoints' THEN 'charging_points' WHEN 'maxPowerKw' THEN 'maximum_power'
                WHEN 'availablePoints' THEN 'available_charging_points' WHEN 'occupiedPoints' THEN 'occupied_charging_points'
                ELSE 'out_of_service_charging_points' END;
            unit_name:=CASE WHEN property.key IN ('lat','lng') THEN 'degrees'
                WHEN property.key='maxPowerKw' THEN 'kW' ELSE 'points' END;
            field_value:=property.value;
            IF jsonb_typeof(field_value)='number' THEN
                numeric_value:=field_value::text::numeric; quality_name:='valid';
            ELSIF jsonb_typeof(field_value)='null' THEN
                numeric_value:=NULL; quality_name:='missing';
            ELSE RAISE EXCEPTION 'Invalid charger numeric field: %',property.key; END IF;
            IF property.key NOT IN ('lat','lng') AND numeric_value<0 THEN
                RAISE EXCEPTION 'Negative charger capacity/count: %',property.key;
            END IF;
            definition:=write_measurement(entity_key,metric_name,unit_name,p_row.source_id,'reported',
                CASE WHEN property.key IN ('lat','lng') THEN '{"crs":"EPSG:4326"}'::jsonb ELSE '{}'::jsonb END,
                sample_time,numeric_value,p_row.fetched_at,
                jsonb_build_object('payload_sha256',p_row.payload_sha256,'time_basis','inventory_effective_time',
                    'availability_basis',station->>'availabilityBasis'),quality_name,NULL,NULL,'reference');
            scalar_path:=CASE WHEN is_map THEN ARRAY['properties',property.key] ELSE ARRAY[property.key] END;
            INSERT INTO measurement_publication_cells VALUES(p_row.dataset,prefix||scalar_path,definition,sample_time);
            item_template:=jsonb_set(item_template,scalar_path,'null'::jsonb,FALSE);
            IF is_map AND property.key IN ('lat','lng') THEN
                IF item.value->'geometry'->>'type' <> 'Point' OR
                    (item.value#>>ARRAY['geometry','coordinates',CASE WHEN property.key='lng' THEN '0' ELSE '1' END])::numeric
                        IS DISTINCT FROM numeric_value THEN
                    RAISE EXCEPTION 'Charger geometry differs from location measurements';
                END IF;
                scalar_path:=ARRAY['geometry','coordinates',CASE WHEN property.key='lng' THEN '0' ELSE '1' END];
                INSERT INTO measurement_publication_cells VALUES(p_row.dataset,prefix||scalar_path,definition,sample_time);
                item_template:=jsonb_set(item_template,scalar_path,'null'::jsonb,FALSE);
            END IF;
        END LOOP;
        items:=items||jsonb_build_array(item_template);
    END LOOP;
    publication_template:=jsonb_set(publication_template,ARRAY[CASE WHEN is_map THEN 'features' ELSE 'stations' END],items,FALSE);
    UPDATE measurement_publications SET template=publication_template WHERE dataset=p_row.dataset;
END $$;

CREATE OR REPLACE FUNCTION read_inventory_publication(p_dataset TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE result JSONB; item RECORD; cell RECORD; item_value JSONB; items JSONB[]:=ARRAY[]::JSONB[];
    container_name TEXT; cells JSONB; cell_path TEXT[]; expected_count INTEGER;
BEGIN
    SELECT template INTO STRICT result FROM measurement_publications WHERE dataset=p_dataset;
    container_name:=CASE WHEN p_dataset='map/layers/charging' THEN 'features' ELSE 'stations' END;
    -- Fetch all bindings once. No database round-trip/query per scalar field.
    SELECT jsonb_object_agg(record_index,record_cells) INTO cells FROM (
        SELECT c.path[2] AS record_index,jsonb_agg(jsonb_build_object('path',c.path,'value',r.value,
            'present',r.measurement_id IS NOT NULL)) AS record_cells
        FROM measurement_publication_cells c
        LEFT JOIN readings r ON r.measurement_id=c.measurement_id AND r.observed_at=c.observed_at
        WHERE c.dataset=p_dataset GROUP BY c.path[2]
    ) grouped;
    FOR item IN SELECT value,ordinality FROM jsonb_array_elements(result->container_name) WITH ORDINALITY LOOP
        item_value:=item.value;
        SELECT count(*) INTO expected_count FROM jsonb_object_keys(
            CASE WHEN container_name='features' THEN item.value->'properties' ELSE item.value END) k
            WHERE k=ANY(ARRAY['lat','lng','totalPoints','maxPowerKw','availablePoints','occupiedPoints','outOfServicePoints']);
        IF container_name='features' THEN expected_count:=expected_count+2; END IF;
        IF COALESCE(jsonb_array_length(cells->((item.ordinality-1)::text)),0) <> expected_count THEN
            RAISE EXCEPTION 'Missing canonical inventory binding: %',p_dataset;
        END IF;
        FOR cell IN SELECT value FROM jsonb_array_elements(COALESCE(cells->((item.ordinality-1)::text),'[]')) LOOP
            IF NOT (cell.value->>'present')::boolean THEN RAISE EXCEPTION 'Missing canonical inventory reading: %',p_dataset; END IF;
            SELECT array_agg(value ORDER BY ordinality) INTO cell_path
                FROM jsonb_array_elements_text(cell.value->'path') WITH ORDINALITY WHERE ordinality>2;
            item_value:=jsonb_set(item_value,cell_path,cell.value->'value',FALSE);
        END LOOP;
        items:=array_append(items,item_value);
    END LOOP;
    RETURN jsonb_set(result,ARRAY[container_name],to_jsonb(items),FALSE);
END $$;

CREATE OR REPLACE FUNCTION shadow_charger_publication() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    PERFORM mirror_charger_publication(NEW);
    RETURN NULL;
END $$;

CREATE OR REPLACE VIEW core_charger_datasets AS
SELECT d.dataset,d.source_id,d.source_url,d.source_updated_at,d.fetched_at,d.expires_at,d.payload_sha256,
    read_inventory_publication(d.dataset) AS data
FROM collected_datasets d JOIN measurement_publications p USING(dataset)
WHERE d.dataset IN ('infrastructure/ev-charging','map/layers/charging')
    AND d.payload_sha256=p.payload_sha256 AND d.source_updated_at=p.source_updated_at;

-- During migration the remaining map families keep their existing read paths.
-- Charger values never fall back to legacy JSON when their projection is absent.
CREATE OR REPLACE VIEW core_map_datasets AS
SELECT dataset,data,expires_at FROM collected_datasets WHERE dataset <> 'map/layers/charging'
UNION ALL
SELECT dataset,data,expires_at FROM core_charger_datasets WHERE dataset='map/layers/charging';
