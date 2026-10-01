-- Publication layout is helper context. Its numeric cells reference readings.
CREATE TABLE IF NOT EXISTS measurement_publications (
    dataset TEXT PRIMARY KEY,
    payload_sha256 TEXT NOT NULL,
    source_updated_at TIMESTAMPTZ NOT NULL,
    template JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS measurement_publication_cells (
    dataset TEXT NOT NULL REFERENCES measurement_publications(dataset) ON DELETE CASCADE,
    path TEXT[] NOT NULL,
    measurement_id BIGINT NOT NULL REFERENCES measurement_definitions(id),
    observed_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY(dataset,path)
);

-- Preserve source scales (e.g. thousands of euros); do not round or silently
-- turn rates into counts. Unknown units stay explicit pending source review.
CREATE OR REPLACE FUNCTION statistical_source_unit(p_table TEXT,p_label TEXT)
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
SELECT CASE
    WHEN p_label ~ '/ %$' THEN '%'
    WHEN p_label LIKE '%Millionen Euro%' THEN 'million EUR'
    WHEN p_label LIKE '%1 000 Euro%' THEN '1000 EUR'
    WHEN p_label LIKE '%Euro je Steuerpflichtigen%' THEN 'EUR/taxpayer'
    WHEN p_label LIKE '%je Einwohner%Euro%' THEN 'EUR/person'
    WHEN p_label LIKE '%Euro%' THEN 'EUR'
    WHEN p_label LIKE '%1 000 m²%' THEN '1000 m²'
    WHEN p_label LIKE '%je km²%' THEN 'people/km²'
    WHEN p_label LIKE '%km2%' THEN 'km²'
    WHEN p_label LIKE '%m²%' THEN 'm²'
    WHEN p_label LIKE '%m³%' THEN 'm³'
    WHEN p_label LIKE '%je 1 000 Einwohner%' THEN 'people/1000 residents'
    WHEN p_label LIKE '%Einwohnerinnen auf 1 000 Einwohner%' THEN 'women/1000 men'
    WHEN p_label LIKE '%Großvieheinheiten%' THEN 'livestock units'
    WHEN p_table='6' OR p_label LIKE '%in Hektar%' OR p_label LIKE '%/ Hektar' THEN 'ha'
    WHEN p_label LIKE '%in Tagen%' THEN 'days'
    WHEN p_table IN ('1','2','3','4','19') OR p_label LIKE 'Einwohner%' THEN 'people'
    WHEN p_table='btw2025' THEN CASE WHEN p_label LIKE '%stimmen%' THEN 'votes' ELSE 'people' END
    WHEN p_table IN ('5','7') AND (p_label LIKE '%Betriebe%' OR p_label LIKE 'davon mit%') THEN 'holdings'
    WHEN p_label LIKE '% / Rinder' OR p_label LIKE '% / Schweine' THEN 'animals'
    WHEN p_table IN ('11','12','13') THEN CASE
        WHEN p_label LIKE '%Wohnfläche%' THEN 'unknown'
        WHEN p_label LIKE '% / Räume' THEN 'rooms'
        WHEN p_label LIKE '% / Wohnungen%' OR p_label LIKE 'Wohnungen%'
            OR p_label LIKE 'Fertiggestellte Wohnungen%' THEN 'dwellings'
        ELSE 'buildings' END
    WHEN p_table='9' AND p_label LIKE '%Betriebe%' THEN 'establishments'
    WHEN p_table='9' AND p_label LIKE '%Personen%' THEN 'people'
    WHEN p_label LIKE '%Steuerpflichtige%' THEN 'taxpayers'
    WHEN p_table='15' THEN CASE WHEN p_label ~ '(Getötete|Schwerverletzte|Leichtverletzte)' THEN 'people' ELSE 'accidents' END
    WHEN p_table='14' THEN CASE p_label WHEN 'Durchschnittliches Bettenangebot' THEN 'beds'
        WHEN 'Ankünfte' THEN 'arrivals' WHEN 'Übernachtungen' THEN 'overnight stays' ELSE 'unknown' END
    ELSE 'unknown' END
$$;

CREATE OR REPLACE FUNCTION statistical_source_period(p_title TEXT,p_label TEXT)
RETURNS TABLE(observed_at TIMESTAMPTZ,period_start TIMESTAMPTZ,period_end TIMESTAMPTZ,time_basis TEXT)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE parts TEXT[]; year_number INTEGER; month_number INTEGER; day_number INTEGER;
    months TEXT[] := ARRAY['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    date_text TEXT;
BEGIN
    -- A column-specific reference date takes precedence over a table year.
    date_text := CASE WHEN p_label ~ '(Zum|[Aa]m) [0-9]+\.' THEN p_label ELSE p_title END;
    parts := regexp_match(date_text,'([0-3]?[0-9])\. (Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember) (20[0-9]{2})');
    IF parts IS NULL THEN
        parts:=regexp_match(date_text,'(?:[Aa]m|[Zz]um) ([0-3]?[0-9])\.([01]?[0-9])\.(20[0-9]{2})');
        IF parts IS NOT NULL THEN parts[2]:=months[parts[2]::integer]; END IF;
    END IF;
    IF parts IS NOT NULL THEN
        day_number:=parts[1]::integer; month_number:=array_position(months,parts[2]); year_number:=parts[3]::integer;
        observed_at:=make_timestamptz(year_number,month_number,day_number,0,0,0,'Europe/Berlin');
        period_start:=NULL; period_end:=NULL; time_basis:='published_reference_date';
    ELSE
        parts:=regexp_match(p_title,'im (Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember) (20[0-9]{2})');
        IF parts IS NOT NULL THEN
            month_number:=array_position(months,parts[1]); year_number:=parts[2]::integer;
            period_start:=make_timestamptz(year_number,month_number,1,0,0,0,'Europe/Berlin');
            period_end:=make_timestamptz(year_number+(month_number/12),month_number%12+1,1,0,0,0,'Europe/Berlin');
            time_basis:='published_month_anchor';
        ELSE
            parts:=regexp_match(p_title,'(20[0-9]{2})');
            IF parts IS NULL THEN RAISE EXCEPTION 'Missing statistical reporting period: %',p_title; END IF;
            year_number:=parts[1]::integer;
            period_start:=make_timestamptz(year_number,1,1,0,0,0,'Europe/Berlin');
            period_end:=make_timestamptz(year_number+1,1,1,0,0,0,'Europe/Berlin');
            time_basis:='published_year_anchor';
        END IF;
        observed_at:=period_start;
    END IF;
    RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION mirror_statistical_publication(p_row collected_datasets)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE tab RECORD; rec RECORD; cell RECORD; period RECORD; publication_template JSONB;
    entity_key TEXT; definition BIGINT; cell_path TEXT[]; unit_name TEXT; quality_name TEXT;
    column_key TEXT; cell_value NUMERIC; dimensions_value JSONB;
BEGIN
    IF p_row.dataset NOT LIKE 'statistics/%' THEN RETURN; END IF;
    IF p_row.source_id NOT IN ('hessen-municipal-statistics','bundeswahlleiterin-2025')
        OR p_row.data->>'basis' IS DISTINCT FROM 'published_statistics'
        OR jsonb_typeof(p_row.data->'tables') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Unsupported statistics publication: %',p_row.dataset;
    END IF;
    publication_template:=p_row.data;
    INSERT INTO measurement_publications VALUES (p_row.dataset,p_row.payload_sha256,p_row.source_updated_at,publication_template)
    ON CONFLICT (dataset) DO UPDATE SET payload_sha256=EXCLUDED.payload_sha256,
        source_updated_at=EXCLUDED.source_updated_at,template=EXCLUDED.template;
    DELETE FROM measurement_publication_cells WHERE dataset=p_row.dataset;
    FOR tab IN SELECT value,ordinality FROM jsonb_array_elements(p_row.data->'tables') WITH ORDINALITY LOOP
        FOR rec IN SELECT value,ordinality FROM jsonb_array_elements(tab.value->'records') WITH ORDINALITY LOOP
            IF COALESCE(rec.value->>'municipality_id','')='' THEN RAISE EXCEPTION 'Missing statistical entity'; END IF;
            entity_key:=CASE WHEN p_row.dataset='statistics/elections' THEN 'electoral-district:' ELSE 'municipality:' END
                ||(rec.value->>'municipality_id');
            INSERT INTO entities(id,name,entity_type,metadata)
            VALUES (entity_key,rec.value->>'name',CASE WHEN p_row.dataset='statistics/elections' THEN 'electoral_district' ELSE 'municipality' END,
                rec.value-'values') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,metadata=EXCLUDED.metadata,updated_at=NOW();
            FOR cell IN SELECT value,ordinality FROM jsonb_array_elements(rec.value->'values') WITH ORDINALITY LOOP
                SELECT * INTO STRICT period FROM statistical_source_period(tab.value->>'title',cell.value->>'label');
                unit_name:=statistical_source_unit(tab.value->>'id',cell.value->>'label');
                IF jsonb_typeof(cell.value->'value')='number' THEN
                    cell_value:=(cell.value->>'value')::numeric; quality_name:='valid';
                ELSIF jsonb_typeof(cell.value->'value')='null' THEN
                    cell_value:=NULL;
                    -- Markers are retained verbatim. A dot alone does not tell
                    -- us whether a value is unavailable or confidentiality-suppressed.
                    quality_name:='missing';
                ELSE RAISE EXCEPTION 'Non-numeric statistical cell: %',cell.value->>'cell'; END IF;
                column_key:=CASE WHEN p_row.source_id='hessen-municipal-statistics'
                    THEN regexp_replace(cell.value->>'cell','[0-9]+$','') ELSE cell.value->>'cell' END;
                dimensions_value:=jsonb_build_object('table',tab.value->>'id','column',column_key,
                    'source_label',cell.value->>'label','time_basis',period.time_basis);
                definition:=write_measurement(entity_key,'published_statistic',unit_name,p_row.source_id,'reported',
                    dimensions_value,period.observed_at,cell_value,p_row.fetched_at,
                    jsonb_build_object('payload_sha256',p_row.payload_sha256,'table_title',tab.value->>'title',
                        'cell',cell.value->>'cell','source_marker',cell.value->'source_marker','time_basis',period.time_basis),
                    quality_name,period.period_start,period.period_end,'reference');
                cell_path:=ARRAY['tables',(tab.ordinality-1)::text,'records',(rec.ordinality-1)::text,
                    'values',(cell.ordinality-1)::text,'value'];
                INSERT INTO measurement_publication_cells VALUES(p_row.dataset,cell_path,definition,period.observed_at);
                publication_template:=jsonb_set(publication_template,cell_path,'null'::jsonb,FALSE);
            END LOOP;
        END LOOP;
    END LOOP;
    UPDATE measurement_publications SET template=publication_template WHERE dataset=p_row.dataset;
END $$;

CREATE OR REPLACE FUNCTION read_measurement_publication(p_dataset TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE result JSONB; tab RECORD; rec RECORD; values_json JSONB;
    records_json JSONB; tables_json JSONB:='[]'; complete BOOLEAN;
BEGIN
    SELECT template INTO STRICT result FROM measurement_publications WHERE dataset=p_dataset;
    -- Assemble one record at a time. Replacing each individual numeric cell in
    -- a large election JSON document repeatedly copies the whole publication.
    FOR tab IN SELECT value,ordinality FROM jsonb_array_elements(result->'tables') WITH ORDINALITY LOOP
        records_json:='[]';
        FOR rec IN SELECT value,ordinality FROM jsonb_array_elements(tab.value->'records') WITH ORDINALITY LOOP
            SELECT COALESCE(jsonb_agg(v.value||jsonb_build_object('value',r.value) ORDER BY v.ordinality),'[]'),
                COALESCE(bool_and(r.measurement_id IS NOT NULL),TRUE)
            INTO values_json,complete
            FROM jsonb_array_elements(rec.value->'values') WITH ORDINALITY v
            LEFT JOIN measurement_publication_cells c ON c.dataset=p_dataset AND c.path=ARRAY[
                'tables',(tab.ordinality-1)::text,'records',(rec.ordinality-1)::text,'values',(v.ordinality-1)::text,'value']
            LEFT JOIN readings r ON r.measurement_id=c.measurement_id AND r.observed_at=c.observed_at;
            IF NOT complete THEN RAISE EXCEPTION 'Missing canonical publication reading: %',p_dataset; END IF;
            records_json:=records_json||jsonb_build_array(rec.value||jsonb_build_object('values',values_json));
        END LOOP;
        tables_json:=tables_json||jsonb_build_array(tab.value||jsonb_build_object('records',records_json));
    END LOOP;
    RETURN result||jsonb_build_object('tables',tables_json);
END $$;

CREATE OR REPLACE FUNCTION shadow_statistical_publication() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    PERFORM mirror_statistical_publication(NEW);
    RETURN NULL;
END $$;

CREATE OR REPLACE VIEW core_statistical_datasets AS
SELECT d.dataset,d.source_id,d.source_url,d.source_updated_at,d.fetched_at,d.expires_at,d.payload_sha256,
    read_measurement_publication(d.dataset) AS data
FROM collected_datasets d JOIN measurement_publications p USING(dataset)
WHERE d.dataset LIKE 'statistics/%' AND d.payload_sha256=p.payload_sha256
    AND d.source_updated_at=p.source_updated_at;
