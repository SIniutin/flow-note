-- +goose Up
CREATE TABLE page_tables (
                             id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                             page_id UUID NOT NULL,
                             dst_id VARCHAR(255) NOT NULL,
                             block_id VARCHAR(255) NOT NULL,

                             CONSTRAINT fk_page_tables_page
                                 FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
);

CREATE INDEX idx_page_tables_page_id ON page_tables(page_id);
CREATE INDEX idx_page_tables_dst_id ON page_tables(dst_id);

-- +goose Down
DROP TABLE IF EXISTS page_tables;