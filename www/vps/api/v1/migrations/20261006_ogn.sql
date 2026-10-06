-- OGN is deliberately isolated from permanent evidence, scalar and archive tables.
CREATE TABLE IF NOT EXISTS ogn_permissions (
    device_key text PRIMARY KEY,
    metadata jsonb NOT NULL,
    valid_until timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS ogn_positions (
    device_key text NOT NULL REFERENCES ogn_permissions(device_key) ON DELETE CASCADE,
    timestamp timestamptz NOT NULL,
    data jsonb NOT NULL,
    PRIMARY KEY(device_key,timestamp)
);
CREATE INDEX IF NOT EXISTS ogn_positions_time ON ogn_positions(timestamp);
CREATE OR REPLACE VIEW ogn_public_positions AS
    SELECT p.device_key,p.timestamp,p.data FROM ogn_positions p
    JOIN ogn_permissions d USING(device_key)
    WHERE d.valid_until>NOW() AND p.timestamp>NOW()-INTERVAL '24 hours'
        AND p.timestamp<=NOW()+INTERVAL '10 seconds';
INSERT INTO collection_sources(id,source_url,adapter,enabled,interval_seconds,description)
VALUES ('ogn-ried','https://www.glidernet.org/','ogn-aprs',true,30,
    'OGN regional live positions; current DDB tracking and identification opt-in; ODbL; no permanent archives')
ON CONFLICT(id) DO NOTHING;
