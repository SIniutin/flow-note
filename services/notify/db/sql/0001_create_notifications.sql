-- +goose Up
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    type TEXT NOT NULL,
    actor_user_id UUID NULL,
    page_id UUID NULL,
    thread_id UUID NULL,
    comment_id UUID NULL,
    payload JSONB NOT NULL,
    dedupe_key TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    read_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedupe_key_not_null
    ON notifications(dedupe_key)
    WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_mentions ON notifications(user_id, created_at DESC)
    WHERE type IN ('mention.page', 'mention.comment') AND cancelled_at IS NULL;

CREATE TABLE IF NOT EXISTS processed_events (
    event_id UUID PRIMARY KEY,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL
);

-- +goose Down
DROP TABLE IF EXISTS processed_events;
DROP TABLE IF EXISTS notifications;
