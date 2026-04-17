-- +goose Up
CREATE TABLE IF NOT EXISTS comment_subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    page_id UUID NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT comment_subscriptions_user_page_unique UNIQUE (user_id, page_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_subscriptions_page_status
    ON comment_subscriptions(page_id, status);

-- +goose Down
DROP TABLE IF EXISTS comment_subscriptions;
