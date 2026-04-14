-- +goose Up
CREATE TABLE page_permissions (
                                  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                  page_id UUID NOT NULL,
                                  user_id UUID NOT NULL,
                                  role VARCHAR(32) NOT NULL CHECK (role IN ('owner', 'editor', 'viewer', 'commenter', 'mentor')),
                                  granted_by UUID NOT NULL,
                                  created_at TIMESTAMP DEFAULT now(),
                                  updated_at TIMESTAMP DEFAULT now(),

                                  CONSTRAINT fk_page_permissions_page
                                      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,

                                  CONSTRAINT uq_page_permissions_page_user
                                      UNIQUE (page_id, user_id)
);

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION update_page_permissions_timestamp() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TRIGGER trigger_update_page_permissions_timestamp
    BEFORE UPDATE ON page_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_page_permissions_timestamp();

-- +goose Down
DROP TRIGGER IF EXISTS trigger_update_page_permissions_timestamp ON page_permissions;
DROP FUNCTION IF EXISTS update_page_permissions_timestamp();
DROP TABLE IF EXISTS page_permissions;