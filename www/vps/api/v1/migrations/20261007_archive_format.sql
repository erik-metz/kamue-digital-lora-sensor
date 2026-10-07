-- Additive archive format upgrade, including databases which retired bootstrap DDL.
ALTER TABLE data_archives ADD COLUMN IF NOT EXISTS entity_ids TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE data_archives ADD COLUMN IF NOT EXISTS format_version INTEGER NOT NULL DEFAULT 1;
