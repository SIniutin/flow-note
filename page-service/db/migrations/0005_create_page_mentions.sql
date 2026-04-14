-- +goose Up
CREATE TABLE page_mentions (
                               id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                               page_id UUID NOT NULL,
                               user_id UUID NOT NULL,
                               block_id UUID NOT NULL,
                               created_at TIMESTAMP DEFAULT now(),

                               CONSTRAINT fk_page_mentions_page
                                   FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,

                               CONSTRAINT uq_page_mentions_unique
                                   UNIQUE (page_id, user_id, block_id)
);

-- +goose Down
DROP TABLE IF EXISTS page_mentions;