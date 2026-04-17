-- +goose Up
CREATE TABLE page_versions (
    id BIGSERIAL PRIMARY KEY,
    page_id UUID NOT NULL,
    date VARCHAR(128) NULL,
    size BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT now(),

    CONSTRAINT fk_page_versions_page
        FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
);

CREATE INDEX idx_page_versions_page_id ON page_versions(page_id);

-- +goose Down
DROP TABLE IF EXISTS page_versions;
