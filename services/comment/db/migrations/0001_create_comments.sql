-- +goose Up
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    parent_id UUID NULL REFERENCES comments(id) ON DELETE SET NULL,
    page_id UUID NOT NULL,
    body_id UUID NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'deleted')),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT comments_body_not_empty CHECK (btrim(body) <> '')
);

CREATE INDEX IF NOT EXISTS idx_comments_page_created
    ON comments(page_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_parent_created
    ON comments(parent_id, created_at ASC)
    WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comments_page_active_created
    ON comments(page_id, created_at DESC)
    WHERE deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_comments_user_created
    ON comments(user_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS comments;
