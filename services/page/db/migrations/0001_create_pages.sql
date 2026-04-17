-- +goose Up
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE pages (
                       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                       title VARCHAR(512) NOT NULL,
                       owner_id UUID NOT NULL,
                       size BIGINT NOT NULL DEFAULT 0,
                       version INT NOT NULL DEFAULT 1,
                       created_at TIMESTAMP DEFAULT now(),
                       updated_at TIMESTAMP DEFAULT now(),
                       deleted_at TIMESTAMP NULL
);

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION update_pages_timestamp() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TRIGGER trigger_update_pages_timestamp
    BEFORE UPDATE ON pages
    FOR EACH ROW
    EXECUTE FUNCTION update_pages_timestamp();

-- +goose Down
DROP TRIGGER IF EXISTS trigger_update_pages_timestamp ON pages;
DROP FUNCTION IF EXISTS update_pages_timestamp();
DROP TABLE IF EXISTS pages;