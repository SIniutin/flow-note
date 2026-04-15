-- +goose Up
ALTER TABLE comments
    ALTER COLUMN body_id TYPE TEXT USING body_id::TEXT;

CREATE INDEX IF NOT EXISTS idx_comments_page_body_id_root
    ON comments(page_id, body_id)
    WHERE body_id IS NOT NULL AND parent_id IS NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_comments_page_body_id_root;

ALTER TABLE comments
    ALTER COLUMN body_id TYPE UUID USING body_id::UUID;
