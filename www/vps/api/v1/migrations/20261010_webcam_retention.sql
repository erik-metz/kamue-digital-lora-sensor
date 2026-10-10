-- Quality describes successful byte observations, not a verified capture time.
ALTER TABLE webcam_snapshot_observations
    ADD COLUMN IF NOT EXISTS unchanged_since TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS unchanged_observations INTEGER NOT NULL DEFAULT 1
        CHECK (unchanged_observations > 0),
    ADD COLUMN IF NOT EXISTS quality_status TEXT NOT NULL DEFAULT 'fresh'
        CHECK (quality_status IN ('fresh','unchanged','suspected_stale'));
CREATE INDEX IF NOT EXISTS webcam_snapshot_observations_observed_at
    ON webcam_snapshot_observations(observed_at);
