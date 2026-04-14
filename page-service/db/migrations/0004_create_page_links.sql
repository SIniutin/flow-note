-- +goose Up
CREATE TABLE page_links (
                            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                            from_page_id UUID NOT NULL,
                            to_page_id UUID NOT NULL,
                            block_id UUID NOT NULL,
                            created_at TIMESTAMP DEFAULT now(),

                            CONSTRAINT fk_page_links_from_page
                                FOREIGN KEY (from_page_id) REFERENCES pages(id) ON DELETE CASCADE,

                            CONSTRAINT fk_page_links_to_page
                                FOREIGN KEY (to_page_id) REFERENCES pages(id) ON DELETE CASCADE
);

-- +goose Down
DROP TABLE IF EXISTS page_links;