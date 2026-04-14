-- +goose Up

-- Speeds up GetByPageIDAndUserID (resolvePageCredentials on every authenticated request)
-- The UNIQUE constraint on (page_id, user_id) already covers page_id-first lookups;
-- this index covers user_id-first lookups (ListPermissionByUserID if ever needed).
CREATE INDEX IF NOT EXISTS idx_page_permissions_user_id
    ON page_permissions (user_id);

-- Speeds up ListPagesByOwnerID (ListMyPages)
CREATE INDEX IF NOT EXISTS idx_pages_owner_id
    ON pages (owner_id)
    WHERE deleted_at IS NULL;

-- Speeds up ListPagesAllowedByUserID join through page_permissions
CREATE INDEX IF NOT EXISTS idx_page_permissions_user_page
    ON page_permissions (user_id, page_id);

-- +goose Down

DROP INDEX IF EXISTS idx_page_permissions_user_id;
DROP INDEX IF EXISTS idx_pages_owner_id;
DROP INDEX IF EXISTS idx_page_permissions_user_page;
