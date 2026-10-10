-- JPEG bytes live in the persistent worker volume; Postgres stores identity and observations.
CREATE TABLE IF NOT EXISTS webcam_snapshot_images (
    source_id TEXT NOT NULL REFERENCES collection_sources(id),
    sha256 TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
    relative_path TEXT NOT NULL UNIQUE,
    byte_count BIGINT NOT NULL CHECK (byte_count > 0),
    width INTEGER NOT NULL CHECK (width > 0),
    height INTEGER NOT NULL CHECK (height > 0),
    first_observed_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (source_id, sha256)
);
CREATE TABLE IF NOT EXISTS webcam_snapshot_observations (
    id BIGSERIAL PRIMARY KEY,
    source_id TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    attempt_id BIGINT NOT NULL UNIQUE REFERENCES collection_attempts(id),
    observed_at TIMESTAMPTZ NOT NULL,
    capture_time TIMESTAMPTZ, -- Unknown: neither HTTP Last-Modified nor fetch time is capture time.
    http_status INTEGER NOT NULL CHECK (http_status IN (200,304)),
    etag TEXT,
    last_modified TEXT, -- Untrusted provider header, deliberately not an inferred timestamp.
    FOREIGN KEY (source_id,sha256) REFERENCES webcam_snapshot_images(source_id,sha256)
);
CREATE INDEX IF NOT EXISTS webcam_snapshot_observations_source_id
    ON webcam_snapshot_observations(source_id,id DESC);
