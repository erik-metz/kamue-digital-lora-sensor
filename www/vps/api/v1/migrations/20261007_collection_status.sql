-- Add evidence for newly completed attempts; never invent historical processing times.
ALTER TABLE collection_attempts ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ;
ALTER TABLE collection_attempts ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE collection_attempts ADD COLUMN IF NOT EXISTS item_count BIGINT CHECK (item_count >= 0);
ALTER TABLE collection_attempts ADD COLUMN IF NOT EXISTS item_count_unit TEXT;
ALTER TABLE collection_attempts ADD COLUMN IF NOT EXISTS error_stage TEXT;
CREATE OR REPLACE FUNCTION collection_attempt_completion() RETURNS trigger AS $$
BEGIN
    IF NEW.status IN ('success','partial') AND NEW.processed_at IS NULL THEN
        IF TG_OP = 'INSERT' THEN
            NEW.processed_at := clock_timestamp();
        ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
            NEW.processed_at := clock_timestamp();
        END IF;
    END IF;
    IF NEW.http_status BETWEEN 200 AND 299 AND NEW.fetched_at IS NULL THEN
        NEW.fetched_at := NEW.received_at;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS collection_attempt_completion ON collection_attempts;
CREATE TRIGGER collection_attempt_completion BEFORE INSERT OR UPDATE ON collection_attempts
FOR EACH ROW EXECUTE FUNCTION collection_attempt_completion();
CREATE INDEX IF NOT EXISTS collection_attempts_fetch_success ON collection_attempts(source_id,fetched_at DESC) WHERE fetched_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS collection_attempts_processed_success ON collection_attempts(source_id,processed_at DESC) WHERE status='success' AND processed_at IS NOT NULL;
