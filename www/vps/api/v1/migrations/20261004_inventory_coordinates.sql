-- Point inventories use ordinary scalar coordinates. Polygons/lines, source IDs,
-- calendar dates and operational coverage counts remain descriptive helpers.
CREATE OR REPLACE FUNCTION is_coordinate_publication(p_dataset TEXT)
RETURNS BOOLEAN LANGUAGE SQL IMMUTABLE AS $$
 SELECT p_dataset IN ('map/layers/companies','map/layers/crops','map/layers/crossings',
   'map/layers/energy','map/layers/nature','map/layers/places','map/layers/wifi',
   'waste/address-inventory','waste/calendar') OR p_dataset LIKE 'transport/stops/%'
$$;

CREATE OR REPLACE FUNCTION normalize_inventory_coordinates(
    p_node JSONB,p_row collected_datasets,p_path TEXT[],p_entity TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE result JSONB:=p_node; part RECORD; entity_key TEXT:=p_entity; lat_key TEXT; lon_key TEXT;
    pair JSONB; coordinate_path TEXT[]; metric_name TEXT; component INTEGER; definition BIGINT;
    scalar_value NUMERIC; title TEXT;
BEGIN
    IF jsonb_typeof(p_node)='array' THEN
        SELECT COALESCE(jsonb_agg(normalize_inventory_coordinates(value,p_row,
            p_path||((ordinality-1)::text),entity_key) ORDER BY ordinality),'[]') INTO result
        FROM jsonb_array_elements(p_node) WITH ORDINALITY;
        RETURN result;
    END IF;
    IF jsonb_typeof(p_node)<>'object' THEN RETURN result; END IF;
    -- Geometry vertices define shapes, not independent GPS observations.
    IF p_node->>'type' IN ('Polygon','MultiPolygon','LineString','MultiLineString') THEN RETURN result; END IF;
    IF p_node ? 'properties' AND p_node->'properties' ? 'id' THEN
        entity_key:='inventory:'||p_row.source_id||':'||(p_node#>>'{properties,id}');
        title:=p_node#>>'{properties,name}';
    ELSIF p_node ? 'id' THEN
        entity_key:='inventory:'||p_row.source_id||':'||
            CASE WHEN p_node->>'type' IN ('node','way','relation')
                THEN 'osm-'||(p_node->>'type')||'-' ELSE '' END||(p_node->>'id');
        title:=p_node->>'name';
    ELSIF p_row.dataset='waste/calendar' AND p_node ? 'street' THEN
        entity_key:='waste-address:'||md5(jsonb_build_array(p_node->'municipality',
            p_node->'street',p_node->'house_number')::text);
        title:=concat_ws(' ',p_node->>'municipality',p_node->>'street',p_node->>'house_number');
    END IF;
    IF p_node ? 'latitude' AND p_node ? 'longitude' THEN lat_key:='latitude';lon_key:='longitude';
    ELSIF p_node ? 'lat' AND p_node ? 'lon' THEN lat_key:='lat';lon_key:='lon'; END IF;
    IF lat_key IS NOT NULL OR p_node->>'type'='Point' THEN
        IF entity_key IS NULL THEN RAISE EXCEPTION 'Missing stable inventory identity in % at %',p_row.dataset,p_path; END IF;
        INSERT INTO entities(id,name,entity_type,metadata)
        VALUES(entity_key,COALESCE(title,entity_key),'inventory_asset',jsonb_build_object('source_id',p_row.source_id))
        ON CONFLICT(id) DO NOTHING;
        pair:=CASE WHEN lat_key IS NOT NULL THEN jsonb_build_array(p_node->lon_key,p_node->lat_key)
            ELSE p_node->'coordinates' END;
        IF jsonb_array_length(pair)<>2 THEN RAISE EXCEPTION 'Expected coordinate pair at %',p_path; END IF;
        FOR component IN 0..1 LOOP
            IF jsonb_typeof(pair->component) NOT IN ('number','null') THEN RAISE EXCEPTION 'Invalid inventory coordinate'; END IF;
            scalar_value:=(pair->>component)::numeric;
            metric_name:=CASE WHEN component=0 THEN 'longitude' ELSE 'latitude' END;
            definition:=write_measurement(entity_key,metric_name,'degrees',p_row.source_id,'reported',
                '{"crs":"EPSG:4326"}',p_row.source_updated_at,scalar_value,p_row.fetched_at,
                jsonb_build_object('payload_sha256',p_row.payload_sha256,'time_basis','inventory_effective_time'),
                CASE WHEN scalar_value IS NULL THEN 'missing' ELSE 'valid' END,NULL,NULL,'reference');
            coordinate_path:=CASE WHEN lat_key IS NOT NULL
                THEN ARRAY[CASE WHEN component=0 THEN lon_key ELSE lat_key END]
                ELSE ARRAY['coordinates',component::text] END;
            INSERT INTO measurement_publication_cells VALUES(p_row.dataset,p_path||coordinate_path,definition,p_row.source_updated_at);
            result:=jsonb_set(result,coordinate_path,'null',FALSE);
        END LOOP;
    END IF;
    FOR part IN SELECT key,value FROM jsonb_each(result) LOOP
        IF jsonb_typeof(part.value) IN ('object','array') AND NOT (part.key='coordinates' AND p_node->>'type'='Point') THEN
            result:=jsonb_set(result,ARRAY[part.key],normalize_inventory_coordinates(part.value,p_row,p_path||part.key,entity_key),FALSE);
        END IF;
    END LOOP;
    RETURN result;
END $$;

CREATE OR REPLACE FUNCTION mirror_coordinate_publication(p_row collected_datasets)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE template_value JSONB;
BEGIN
    IF NOT is_coordinate_publication(p_row.dataset) THEN RETURN; END IF;
    INSERT INTO measurement_publications VALUES(p_row.dataset,p_row.payload_sha256,p_row.source_updated_at,p_row.data)
    ON CONFLICT(dataset) DO UPDATE SET payload_sha256=EXCLUDED.payload_sha256,
        source_updated_at=EXCLUDED.source_updated_at,template=EXCLUDED.template;
    DELETE FROM measurement_publication_cells WHERE dataset=p_row.dataset;
    template_value:=normalize_inventory_coordinates(p_row.data,p_row,ARRAY[]::TEXT[]);
    UPDATE measurement_publications SET template=template_value WHERE dataset=p_row.dataset;
END $$;

CREATE OR REPLACE FUNCTION restore_inventory_coordinates(p_node JSONB,p_values JSONB,p_path TEXT[])
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE result JSONB; path_key TEXT:=to_jsonb(p_path)::text;
BEGIN
    IF p_node='null'::jsonb AND p_values ? path_key THEN RETURN p_values->path_key; END IF;
    IF jsonb_typeof(p_node)='object' THEN
        IF p_node->>'type' IN ('Polygon','MultiPolygon','LineString','MultiLineString') THEN RETURN p_node; END IF;
        SELECT COALESCE(jsonb_object_agg(key,restore_inventory_coordinates(value,p_values,p_path||key)),'{}')
            INTO result FROM jsonb_each(p_node);
        RETURN result;
    ELSIF jsonb_typeof(p_node)='array' THEN
        SELECT COALESCE(jsonb_agg(restore_inventory_coordinates(value,p_values,p_path||((ordinality-1)::text)) ORDER BY ordinality),'[]')
            INTO result FROM jsonb_array_elements(p_node) WITH ORDINALITY;
        RETURN result;
    END IF;
    RETURN p_node;
END $$;

CREATE OR REPLACE FUNCTION read_coordinate_publication(p_dataset TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE template_value JSONB; values_by_path JSONB; missing BIGINT;
BEGIN
    SELECT template INTO STRICT template_value FROM measurement_publications WHERE dataset=p_dataset;
    SELECT COALESCE(jsonb_object_agg(to_jsonb(c.path)::text,to_jsonb(r.value)),'{}'),
        count(*) FILTER(WHERE r.measurement_id IS NULL) INTO values_by_path,missing
    FROM measurement_publication_cells c LEFT JOIN readings r
        ON r.measurement_id=c.measurement_id AND r.observed_at=c.observed_at WHERE c.dataset=p_dataset;
    IF missing<>0 THEN RAISE EXCEPTION 'Inventory publication has missing readings: %',p_dataset; END IF;
    RETURN restore_inventory_coordinates(template_value,values_by_path,ARRAY[]::TEXT[]);
END $$;

CREATE OR REPLACE FUNCTION shadow_coordinate_publication() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM mirror_coordinate_publication(NEW); RETURN NULL; END $$;

CREATE OR REPLACE VIEW core_coordinate_datasets AS
SELECT d.dataset,d.source_id,d.source_url,d.source_updated_at,d.fetched_at,d.expires_at,d.payload_sha256,
    read_coordinate_publication(d.dataset) AS data
FROM collected_datasets d JOIN measurement_publications p USING(dataset)
WHERE is_coordinate_publication(d.dataset) AND d.payload_sha256=p.payload_sha256 AND d.source_updated_at=p.source_updated_at;

CREATE OR REPLACE VIEW core_map_datasets AS
SELECT dataset,data,expires_at FROM collected_datasets WHERE dataset NOT IN ('map/layers/charging','map/layers/floods')
    AND NOT is_coordinate_publication(dataset)
UNION ALL SELECT dataset,data,expires_at FROM core_charger_datasets WHERE dataset='map/layers/charging'
UNION ALL SELECT dataset,data,expires_at FROM core_gauge_datasets WHERE dataset='map/layers/floods'
UNION ALL SELECT dataset,data,expires_at FROM core_coordinate_datasets;
