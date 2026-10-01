-- Compatibility projections retain API field names, not independent values.
-- Existing routes filter by the public sensor ID, not its internal prefix.
-- Index that exact projection so each map station does not scan definitions.
CREATE INDEX IF NOT EXISTS core_legacy_sensor_lookup
ON measurement_definitions ((substr(entity_id,8)),metric,unit)
WHERE entity_id LIKE 'sensor:%' AND source_id LIKE 'legacy-sensor:%';

CREATE OR REPLACE VIEW core_sensor_data AS
SELECT r.observed_at AS timestamp,substr(d.entity_id,8) AS sensor_id,
       r.value::double precision AS value,d.unit,d.metric
FROM readings r JOIN measurement_definitions d ON d.id=r.measurement_id
WHERE d.entity_id LIKE 'sensor:%' AND d.source_id LIKE 'legacy-sensor:%' AND r.quality='valid';

CREATE OR REPLACE VIEW core_sensor_latest AS
SELECT r.observed_at AS timestamp,substr(d.entity_id,8) AS sensor_id,
       r.value::double precision AS value,d.unit,d.metric
FROM latest_readings r JOIN measurement_definitions d ON d.id=r.measurement_id
WHERE d.entity_id LIKE 'sensor:%' AND d.source_id LIKE 'legacy-sensor:%' AND r.quality='valid';

CREATE OR REPLACE VIEW core_sensor_metadata AS
SELECT substr(e.id,8) AS id,e.name AS friendly_name,
       CASE WHEN e.metadata->>'has_latitude'='true' THEN p.latitude::double precision END AS latitude,
       CASE WHEN e.metadata->>'has_longitude'='true' THEN p.longitude::double precision END AS longitude,
       e.is_hidden,e.metadata->>'description' AS description,
       (e.metadata->>'source_created_at')::timestamptz AS created_at,
       (e.metadata->>'source_updated_at')::timestamptz AS updated_at
FROM entities e LEFT JOIN LATERAL (
    SELECT MAX(r.value) FILTER (WHERE d.metric='latitude') AS latitude,
           MAX(r.value) FILTER (WHERE d.metric='longitude') AS longitude
    FROM measurement_definitions d JOIN latest_readings r ON r.measurement_id=d.id AND r.quality='valid'
    WHERE d.entity_id=e.id AND d.metric IN ('latitude','longitude') AND d.source_id='sensor-inventory'
) p ON TRUE
WHERE e.id LIKE 'sensor:%' AND e.metadata->>'legacy_deleted' IS DISTINCT FROM 'true';

-- The existing latest row supplies trip text, cancellations and validity only.
-- Coordinates and motion metrics are reconstructed from timestamp-matched values.
CREATE OR REPLACE VIEW core_movement_latest AS
SELECT m.entity_id,m.basis,m.timestamp,m.valid_until,
    (m.data - ARRAY['latitude','longitude','speed_kmh','delay_seconds']) ||
    jsonb_build_object('latitude',v.latitude,'longitude',v.longitude) ||
    CASE WHEN v.speed IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('speed_kmh',v.speed) END ||
    CASE WHEN v.delay IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('delay_seconds',v.delay) END AS data
FROM movement_latest m JOIN LATERAL (
    SELECT MAX(r.value) FILTER (WHERE d.metric='latitude') AS latitude,
           MAX(r.value) FILTER (WHERE d.metric='longitude') AS longitude,
           MAX(r.value) FILTER (WHERE d.metric='speed') AS speed,
           MAX(r.value) FILTER (WHERE d.metric='delay') AS delay
    FROM measurement_definitions d JOIN readings r ON r.measurement_id=d.id
    WHERE d.entity_id='movement:'||m.entity_id AND d.source_id=m.data->>'source_id'
        AND d.basis=m.basis AND r.observed_at=m.timestamp AND r.quality='valid'
        AND ((d.metric IN ('latitude','longitude') AND d.unit='degrees'
                AND d.dimensions='{"crs":"EPSG:4326"}'::jsonb)
            OR (d.metric='speed' AND d.unit='km/h' AND d.dimensions='{}'::jsonb)
            OR (d.metric='delay' AND d.unit='s' AND d.dimensions='{}'::jsonb))
) v ON v.latitude IS NOT NULL AND v.longitude IS NOT NULL;
