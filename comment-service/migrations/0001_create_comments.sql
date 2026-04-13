-- +goose Up
CREATE TABLE IF NOT EXISTS comment_threads (
    id UUID PRIMARY KEY,
    page_id UUID NOT NULL,
    anchor JSONB NOT NULL,
    anchor_hash TEXT NULL,
    created_by UUID NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'resolved', 'deleted')),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    resolved_by UUID NULL,
    resolved_at TIMESTAMPTZ NULL,
    last_commented_at TIMESTAMPTZ NULL,
    comments_count INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_comment_threads_page_created ON comment_threads(page_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_threads_page_active ON comment_threads(page_id, updated_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_comment_threads_anchor_hash ON comment_threads(anchor_hash) WHERE anchor_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES comment_threads(id),
    parent_comment_id UUID NULL REFERENCES comments(id),
    author_id UUID NOT NULL,
    body JSONB NOT NULL,
    body_text TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    edited_at TIMESTAMPTZ NULL,
    deleted_at TIMESTAMPTZ NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_comments_thread_created ON comments(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_active_thread ON comments(thread_id, created_at ASC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS comment_mentions (
    id UUID PRIMARY KEY,
    comment_id UUID NOT NULL REFERENCES comments(id),
    mentioned_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE(comment_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_mentions_user ON comment_mentions(mentioned_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS thread_subscriptions (
    thread_id UUID NOT NULL REFERENCES comment_threads(id),
    user_id UUID NOT NULL,
    is_following BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY(thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS thread_participants (
    thread_id UUID NOT NULL REFERENCES comment_threads(id),
    user_id UUID NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY(thread_id, user_id, role)
);

-- +goose Down
DROP TABLE IF EXISTS thread_participants;
DROP TABLE IF EXISTS thread_subscriptions;
DROP TABLE IF EXISTS comment_mentions;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS comment_threads;
