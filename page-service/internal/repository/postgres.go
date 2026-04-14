package repository

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/flow-note/page-service/internal/domain"
)

type Repository struct {
	db *pgxpool.Pool
}

var _ PageRepository = (*Repository)(nil)
var _ VersionRepository = (*Repository)(nil)
var _ PermissionRepository = (*Repository)(nil)
var _ LinkRepository = (*Repository)(nil)
var _ MentionRepository = (*Repository)(nil)
var _ TableRepository = (*Repository)(nil)
var _ MediaRepository = (*Repository)(nil)

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// PageRepository

func (r *Repository) CreatePage(ctx context.Context, title string, ownerID uuid.UUID) (*domain.Page, error) {
	const query = `
		INSERT INTO pages (title, owner_id)
		VALUES ($1, $2)
		RETURNING id, title, owner_id, size, version, created_at, updated_at, deleted_at
	`

	var page domain.Page
	if err := r.db.QueryRow(ctx, query, title, ownerID).Scan(
		&page.ID,
		&page.Title,
		&page.OwnerID,
		&page.Size,
		&page.Version,
		&page.CreatedAt,
		&page.UpdatedAt,
		&page.DeletedAt,
	); err != nil {
		return nil, err
	}

	return &page, nil
}

func (r *Repository) GetPage(ctx context.Context, pageID uuid.UUID) (*domain.Page, error) {
	const query = `
		SELECT id, title, owner_id, size, version, created_at, updated_at, deleted_at
		FROM pages
		WHERE id = $1
	`

	var page domain.Page
	if err := r.db.QueryRow(ctx, query, pageID).Scan(
		&page.ID,
		&page.Title,
		&page.OwnerID,
		&page.Size,
		&page.Version,
		&page.CreatedAt,
		&page.UpdatedAt,
		&page.DeletedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrPageNotFound
		}
		return nil, err
	}

	return &page, nil
}

func (r *Repository) UpdatePage(ctx context.Context, pageID uuid.UUID, title string, size int64, versionId int64) (*domain.Page, error) {
	const query = `
		UPDATE pages
		SET title = $2, size = $3, version = $4
		WHERE id = $1
		RETURNING id, title, owner_id, size, version, created_at, updated_at, deleted_at
	`

	var page domain.Page
	if err := r.db.QueryRow(ctx, query, pageID, title, size, versionId).Scan(
		&page.ID,
		&page.Title,
		&page.OwnerID,
		&page.Size,
		&page.Version,
		&page.CreatedAt,
		&page.UpdatedAt,
		&page.DeletedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrPageNotFound
		}
		return nil, err
	}

	return &page, nil
}

func (r *Repository) DeletePage(ctx context.Context, pageID uuid.UUID) error {
	const query = `DELETE FROM pages WHERE id = $1`
	ct, err := r.db.Exec(ctx, query, pageID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return domain.ErrPageNotFound
	}
	return nil
}

func (r *Repository) ListPagesByOwnerID(ctx context.Context, ownerID uuid.UUID, limit, offset int32) ([]domain.Page, error) {
	const query = `
		SELECT id, title, owner_id, size, version, created_at, updated_at, deleted_at
		FROM pages
		WHERE owner_id = $1
		ORDER BY updated_at DESC, id DESC
		LIMIT $2 OFFSET $3
	`
	return r.listPages(ctx, query, ownerID, limit, offset)
}

func (r *Repository) ListPagesAllowedByUserID(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]domain.Page, error) {
	const query = `
		SELECT DISTINCT p.id, p.title, p.owner_id, p.size, p.version, p.created_at, p.updated_at, p.deleted_at
		FROM pages p
		LEFT JOIN page_permissions pp ON pp.page_id = p.id
		WHERE p.owner_id = $1 OR pp.user_id = $1
		ORDER BY p.updated_at DESC, p.id DESC
		LIMIT $2 OFFSET $3
	`
	return r.listPages(ctx, query, userID, limit, offset)
}

func (r *Repository) listPages(ctx context.Context, query string, args ...any) ([]domain.Page, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pages := make([]domain.Page, 0)
	for rows.Next() {
		var page domain.Page
		if err := rows.Scan(
			&page.ID,
			&page.Title,
			&page.OwnerID,
			&page.Size,
			&page.Version,
			&page.CreatedAt,
			&page.UpdatedAt,
			&page.DeletedAt,
		); err != nil {
			return nil, err
		}
		pages = append(pages, page)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return pages, nil
}

// VersionRepository

func (r *Repository) CreateVersion(ctx context.Context, pageID uuid.UUID, size int64, keyToSnapshot string) (*domain.Version, error) {
	const query = `
		INSERT INTO page_versions (page_id, date, size)
		VALUES ($1, $2, $3)
		RETURNING id, page_id, date, size, created_at
	`

	var version domain.Version
	if err := r.db.QueryRow(ctx, query, pageID, keyToSnapshot, size).Scan(
		&version.Id,
		&version.PageId,
		&version.Date,
		&version.Size,
		&version.CreatedAt,
	); err != nil {
		return nil, err
	}

	return &version, nil
}

func (r *Repository) GetCurrentVersion(ctx context.Context, pageID uuid.UUID, versionId int64) (*domain.Version, error) {
	const query = `
		SELECT id, page_id, date, size, created_at
		FROM page_versions
		WHERE page_id = $1 AND id = $2
	`

	return r.getVersion(ctx, query, pageID, versionId)
}

func (r *Repository) GetLastVersion(ctx context.Context, pageID uuid.UUID) (*domain.Version, error) {
	const query = `
		SELECT id, page_id, date, size, created_at
		FROM page_versions
		WHERE page_id = $1
		ORDER BY id DESC
		LIMIT 1
	`
	return r.getVersion(ctx, query, pageID)
}

func (r *Repository) ListVersions(ctx context.Context, pageID uuid.UUID, limit, offset int32) ([]domain.Version, error) {
	const query = `
		SELECT id, page_id, date, size, created_at
		FROM page_versions
		WHERE page_id = $1
		ORDER BY id DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, pageID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	versions := make([]domain.Version, 0)
	for rows.Next() {
		var version domain.Version
		if err := rows.Scan(&version.Id, &version.PageId, &version.Date, &version.Size, &version.CreatedAt); err != nil {
			return nil, err
		}
		versions = append(versions, version)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return versions, nil
}

func (r *Repository) getVersion(ctx context.Context, query string, args ...any) (*domain.Version, error) {
	var version domain.Version
	if err := r.db.QueryRow(ctx, query, args...).Scan(
		&version.Id,
		&version.PageId,
		&version.Date,
		&version.Size,
		&version.CreatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrVersionNotFound
		}
		return nil, err
	}

	return &version, nil
}

// PermissionRepository

func (r *Repository) CreatePermission(ctx context.Context, pageID uuid.UUID, userID uuid.UUID, role domain.PermissionRole) (*domain.Permission, error) {
	const query = `
		INSERT INTO page_permissions (page_id, user_id, role, granted_by)
		VALUES ($1, $2, $3, $2)
		RETURNING id, page_id, user_id, role, granted_by, created_at, updated_at
	`
	return r.scanPermissionRow(ctx, query, pageID, userID, string(role))
}

func (r *Repository) UpdateRolePermission(ctx context.Context, pageID uuid.UUID, userID uuid.UUID, role domain.PermissionRole) (*domain.Permission, error) {
	const query = `
		UPDATE page_permissions
		SET role = $3
		WHERE page_id = $1 AND user_id = $2
		RETURNING id, page_id, user_id, role, granted_by, created_at, updated_at
	`
	return r.scanPermissionRow(ctx, query, pageID, userID, string(role))
}

func (r *Repository) DeletePermission(ctx context.Context, pageID uuid.UUID, userID uuid.UUID) error {
	const query = `DELETE FROM page_permissions WHERE page_id = $1 AND user_id = $2`
	ct, err := r.db.Exec(ctx, query, pageID, userID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return domain.ErrPermissionNotFound
	}
	return nil
}

func (r *Repository) ListPermissionByPageID(ctx context.Context, pageID uuid.UUID) ([]domain.Permission, error) {
	const query = `
		SELECT id, page_id, user_id, role, granted_by, created_at, updated_at
		FROM page_permissions
		WHERE page_id = $1
		ORDER BY created_at ASC, id ASC
	`

	rows, err := r.db.Query(ctx, query, pageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	permissions := make([]domain.Permission, 0)
	for rows.Next() {
		permission, err := scanPermission(rows)
		if err != nil {
			return nil, err
		}
		permissions = append(permissions, permission)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return permissions, nil
}

func (r *Repository) GetByPageIDAndUserID(ctx context.Context, pageID uuid.UUID, userID uuid.UUID) (*domain.Permission, error) {
	const query = `
		SELECT id, page_id, user_id, role, granted_by, created_at, updated_at
		FROM page_permissions
		WHERE page_id = $1 AND user_id = $2
	`

	row := r.db.QueryRow(ctx, query, pageID, userID)
	permission, err := scanPermission(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrPermissionNotFound
		}
		return nil, err
	}

	return &permission, nil
}

func (r *Repository) scanPermissionRow(ctx context.Context, query string, args ...any) (*domain.Permission, error) {
	row := r.db.QueryRow(ctx, query, args...)
	permission, err := scanPermission(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrPermissionNotFound
		}
		msg := strings.ToLower(err.Error())
		if strings.Contains(msg, "unique") {
			return nil, domain.ErrPermissionAlreadyExists
		}
		return nil, err
	}
	return &permission, nil
}

func scanPermission(row interface{ Scan(dest ...any) error }) (domain.Permission, error) {
	var permission domain.Permission
	var role string
	var grantedBy uuid.UUID
	if err := row.Scan(
		&permission.ID,
		&permission.PageID,
		&permission.UserID,
		&role,
		&grantedBy,
		&permission.CreatedAt,
		&permission.UpdatedAt,
	); err != nil {
		return domain.Permission{}, err
	}
	permission.Role = domain.PermissionRole(role)
	permission.GrantedBy = grantedBy
	return permission, nil
}

// LinkRepository

func (r *Repository) ReplaceLinksByPageID(ctx context.Context, pageID uuid.UUID, links []domain.PageLinkInput) error {
	return r.withTx(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `DELETE FROM page_links WHERE from_page_id = $1`, pageID); err != nil {
			return err
		}
		if len(links) == 0 {
			return nil
		}

		rows := make([][]any, 0, len(links))
		for _, link := range links {
			rows = append(rows, []any{pageID, link.ToPageID, link.BlockID})
		}

		_, err := tx.CopyFrom(
			ctx,
			pgx.Identifier{"page_links"},
			[]string{"from_page_id", "to_page_id", "block_id"},
			pgx.CopyFromRows(rows),
		)
		if err != nil {
			return err
		}

		return nil
	})
}

func (r *Repository) ListLinksByPageID(ctx context.Context, pageID uuid.UUID) ([]domain.PageLink, error) {
	const query = `
		SELECT id, from_page_id, to_page_id, block_id, created_at
		FROM page_links
		WHERE from_page_id = $1
		ORDER BY created_at ASC, id ASC
	`
	rows, err := r.db.Query(ctx, query, pageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanPageLinks(rows)
}

func (r *Repository) GetPageConnectedLinks(ctx context.Context, pageID uuid.UUID) ([]domain.Page, []domain.PageLink, error) {
	const pagesQuery = `
		WITH RECURSIVE component AS (
			SELECT $1::uuid AS page_id
			UNION
			SELECT pl.to_page_id
			FROM page_links pl
			JOIN component c ON pl.from_page_id = c.page_id
			UNION
			SELECT pl.from_page_id
			FROM page_links pl
			JOIN component c ON pl.to_page_id = c.page_id
		)
		SELECT p.id, p.title, p.owner_id, p.size, p.version, p.created_at, p.updated_at, p.deleted_at
		FROM pages p
		WHERE p.id IN (SELECT page_id FROM component)
		ORDER BY p.created_at ASC, p.id ASC
	`

	const linksQuery = `
		WITH RECURSIVE component AS (
			SELECT $1::uuid AS page_id
			UNION
			SELECT pl.to_page_id
			FROM page_links pl
			JOIN component c ON pl.from_page_id = c.page_id
			UNION
			SELECT pl.from_page_id
			FROM page_links pl
			JOIN component c ON pl.to_page_id = c.page_id
		)
		SELECT pl.id, pl.from_page_id, pl.to_page_id, pl.block_id, pl.created_at
		FROM page_links pl
		WHERE pl.from_page_id IN (SELECT page_id FROM component)
		  AND pl.to_page_id IN (SELECT page_id FROM component)
		ORDER BY pl.created_at ASC, pl.id ASC
	`

	pages, err := r.listPages(ctx, pagesQuery, pageID)
	if err != nil {
		return nil, nil, err
	}

	rows, err := r.db.Query(ctx, linksQuery, pageID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	links, err := scanPageLinks(rows)
	if err != nil {
		return nil, nil, err
	}

	return pages, links, nil
}

func scanPageLinks(rows pgx.Rows) ([]domain.PageLink, error) {
	links := make([]domain.PageLink, 0)
	for rows.Next() {
		var link domain.PageLink
		if err := rows.Scan(&link.ID, &link.FromPageID, &link.ToPageID, &link.BlockID); err != nil {
			return nil, err
		}
		links = append(links, link)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return links, nil
}

// MentionRepository

func (r *Repository) ReplaceMentionByPageID(ctx context.Context, pageID uuid.UUID, mentions []domain.PageMentionInput) error {
	return r.withTx(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `DELETE FROM page_mentions WHERE page_id = $1`, pageID); err != nil {
			return err
		}
		if len(mentions) == 0 {
			return nil
		}

		rows := make([][]any, 0, len(mentions))
		for _, mention := range mentions {
			rows = append(rows, []any{pageID, mention.UserID, mention.BlockID})
		}

		_, err := tx.CopyFrom(
			ctx,
			pgx.Identifier{"page_mentions"},
			[]string{"page_id", "user_id", "block_id"},
			pgx.CopyFromRows(rows),
		)
		if err != nil {
			return err
		}

		return nil
	})
}

func (r *Repository) ListMentionsByPageID(ctx context.Context, pageID uuid.UUID) ([]domain.Mention, error) {
	const query = `
		SELECT id, page_id, user_id, block_id, created_at
		FROM page_mentions
		WHERE page_id = $1
		ORDER BY created_at ASC, id ASC
	`
	rows, err := r.db.Query(ctx, query, pageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	mentions := make([]domain.Mention, 0)
	for rows.Next() {
		var mention domain.Mention
		if err := rows.Scan(&mention.ID, &mention.PageID, &mention.UserID, &mention.BlockID); err != nil {
			return nil, err
		}
		mentions = append(mentions, mention)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return mentions, nil
}

// TableRepository

func (r *Repository) ReplaceTableByPageID(ctx context.Context, pageID uuid.UUID, tables []domain.PageTableInput) error {
	return r.withTx(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `DELETE FROM page_tables WHERE page_id = $1`, pageID); err != nil {
			return err
		}
		if len(tables) == 0 {
			return nil
		}

		rows := make([][]any, 0, len(tables))
		for _, table := range tables {
			rows = append(rows, []any{pageID, table.DstID, table.BlockID})
		}

		_, err := tx.CopyFrom(
			ctx,
			pgx.Identifier{"page_tables"},
			[]string{"page_id", "dst_id", "block_id"},
			pgx.CopyFromRows(rows),
		)
		if err != nil {
			return err
		}

		return nil
	})
}

func (r *Repository) ListTablesByPageID(ctx context.Context, pageID uuid.UUID) ([]domain.Table, error) {
	const query = `
		SELECT id, page_id, dst_id, block_id
		FROM page_tables
		WHERE page_id = $1
		ORDER BY id ASC
	`
	rows, err := r.db.Query(ctx, query, pageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tables := make([]domain.Table, 0)
	for rows.Next() {
		var table domain.Table
		if err := rows.Scan(&table.ID, &table.PageId, &table.DstId, &table.BlockId); err != nil {
			return nil, err
		}
		tables = append(tables, table)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return tables, nil
}

// MediaRepository

func (r *Repository) ReplaceMediasByPageID(ctx context.Context, pageID uuid.UUID, media []domain.PageMediaInput) error {
	return r.withTx(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `DELETE FROM page_media WHERE page_id = $1`, pageID); err != nil {
			return err
		}
		if len(media) == 0 {
			return nil
		}

		rows := make([][]any, 0, len(media))
		for _, medium := range media {
			rows = append(rows, []any{pageID, string(medium.Type), medium.BlockID})
		}

		_, err := tx.CopyFrom(
			ctx,
			pgx.Identifier{"page_media"},
			[]string{"page_id", "type", "block_id"},
			pgx.CopyFromRows(rows),
		)
		if err != nil {
			return err
		}

		return nil
	})
}

func (r *Repository) ListMediasByPageID(ctx context.Context, pageID uuid.UUID) ([]domain.Media, error) {
	const query = `
		SELECT id, page_id, size, type, block_id
		FROM page_media
		WHERE page_id = $1
		ORDER BY id ASC
	`
	rows, err := r.db.Query(ctx, query, pageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	media := make([]domain.Media, 0)
	for rows.Next() {
		var medium domain.Media
		var mediaType string
		if err := rows.Scan(&medium.ID, &medium.PageID, &medium.Size, &mediaType, &medium.BlockId); err != nil {
			return nil, err
		}
		medium.Type = domain.MediaType(mediaType)
		media = append(media, medium)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return media, nil
}

// TODO: вынести хуйню
func (r *Repository) withTx(ctx context.Context, fn func(tx pgx.Tx) error) error {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
