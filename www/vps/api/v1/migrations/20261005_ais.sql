
-- Reported ship positions reuse the movement history and canonical scalar writer.
ALTER TABLE movement_positions DROP CONSTRAINT IF EXISTS movement_positions_kind_check;
ALTER TABLE movement_positions ADD CONSTRAINT movement_positions_kind_check
    CHECK(kind IN ('bus','train','waste','ship'));
CREATE TABLE IF NOT EXISTS ais_vessels (
    mmsi TEXT PRIMARY KEY CHECK(mmsi ~ '^[1-9][0-9]{8}$'),
    updated_at TIMESTAMPTZ NOT NULL,
    metadata JSONB NOT NULL
);
INSERT INTO collection_sources(id,source_url,adapter,enabled,interval_seconds,description)
VALUES ('aisstream-rhein','https://aisstream.io/','ais-websocket',true,60,
    'AISstream reception Worms–Gernsheim; connected does not imply complete vessel coverage')
ON CONFLICT(id) DO NOTHING;
