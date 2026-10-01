-- Explicit retirement, never run automatically by install(). These registries
-- have no active collector or mounted API reader; current domain publications
-- are collected_datasets/measurement_publications instead. No CASCADE.
DO $$
DECLARE targets TEXT[] := ARRAY[
    'agriculture_crop_zones','agriculture_municipal_stats','boris_land_value_zones',
    'broadband_coverage','business_registrations','commuter_flows','companies',
    'construction_permits','cultural_events','demographic_snapshots','development_plans',
    'educational_facilities','election_district_results','election_districts','election_events',
    'energy_production_readings','energy_facilities','environmental_map_services',
    'ev_charging_status','ev_charging_stations','finance_expenditures','finance_budgets',
    'flood_infrastructure','groundwater_stations','housing_stock_stats','industry_employment',
    'land_use_polygons','municipal_statistics','municipality_tax_rates','municipalities',
    'nature_protected_areas','noise_corridors','public_wifi_hotspots','rail_crossing_events',
    'rail_crossings','realestate_market_benchmarks','realestate_sources','regional_facilities',
    'road_condition_segments','startup_initiatives','train_positions','zakb_waste_statistics'
];
    target TEXT; has_rows BOOLEAN; drop_list TEXT; removed TEXT[] := ARRAY[]::TEXT[];
BEGIN
    PERFORM pg_advisory_xact_lock(2026093001);
    SET LOCAL lock_timeout='10s';
    FOREACH target IN ARRAY targets LOOP
        IF to_regclass('public.'||target) IS NOT NULL THEN
            EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',target);
            EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I LIMIT 1)',target) INTO has_rows;
            IF has_rows THEN
                RAISE EXCEPTION 'Retirement refused: % contains data requiring a migration',target;
            END IF;
            removed:=array_append(removed,target);
        END IF;
    END LOOP;
    SELECT string_agg(format('public.%I',name),',') INTO drop_list FROM unnest(removed) AS name;
    IF drop_list IS NOT NULL THEN EXECUTE 'DROP TABLE '||drop_list||' RESTRICT'; END IF;
    INSERT INTO measurement_migration_state(name,state)
    VALUES ('retired_unused_registries',jsonb_build_object('tables',to_jsonb(removed),'retired_at',NOW()))
    ON CONFLICT(name) DO UPDATE SET state=measurement_migration_state.state,
        updated_at=measurement_migration_state.updated_at;
END $$;
