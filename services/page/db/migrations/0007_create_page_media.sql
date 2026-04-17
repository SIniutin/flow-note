-- +goose Up
CREATE TABLE page_media (
                            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                            page_id UUID NOT NULL,
                            size BIGINT NOT NULL DEFAULT 0,
                            type VARCHAR(32) NOT NULL CHECK (type IN (
                                'IMAGE',
                                'VIDEO',
                                'FILE',
                                'AUDIO'
                            )),
                            block_id VARCHAR(255) NOT NULL,

                            CONSTRAINT fk_page_media_page
                                FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
);

CREATE INDEX idx_page_media_page_id ON page_media(page_id);
CREATE INDEX idx_page_media_type ON page_media(type);

-- +goose Down
DROP TABLE IF EXISTS page_media;