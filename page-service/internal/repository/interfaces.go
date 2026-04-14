package repository

import (
	"context"

	"github.com/google/uuid"

	"github.com/flow-note/page-service/internal/domain"
)

type PageRepository interface {
	CreatePage(ctx context.Context, title string, ownerID uuid.UUID) (*domain.Page, error)
	GetPage(ctx context.Context, pageID uuid.UUID) (*domain.Page, error)
	UpdatePage(ctx context.Context, pageID uuid.UUID, title string, size int64, versionId int64) (*domain.Page, error)
	DeletePage(ctx context.Context, pageID uuid.UUID) error
	ListPagesByOwnerID(ctx context.Context, ownerID uuid.UUID, limit, offset int32) ([]domain.Page, error)
	ListPagesAllowedByUserID(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]domain.Page, error)
}

type VersionRepository interface {
	CreateVersion(ctx context.Context, pageID uuid.UUID, size int64, keyToSnapshot string) (*domain.Version, error)
	GetCurrentVersion(ctx context.Context, pageID uuid.UUID, versionId int64) (*domain.Version, error)
	GetLastVersion(ctx context.Context, pageID uuid.UUID) (*domain.Version, error)
	ListVersions(ctx context.Context, pageID uuid.UUID, limit, offset int32) ([]domain.Version, error)
}

type PermissionRepository interface {
	CreatePermission(ctx context.Context, pageID uuid.UUID, userID uuid.UUID, role domain.PermissionRole) (*domain.Permission, error)
	UpdateRolePermission(ctx context.Context, pageID uuid.UUID, userID uuid.UUID, role domain.PermissionRole) (*domain.Permission, error)
	DeletePermission(ctx context.Context, pageID uuid.UUID, userID uuid.UUID) error
	ListPermissionByPageID(ctx context.Context, pageID uuid.UUID) ([]domain.Permission, error)
	GetByPageIDAndUserID(ctx context.Context, pageID uuid.UUID, userID uuid.UUID) (*domain.Permission, error)
}

type LinkRepository interface {
	ReplaceLinksByPageID(ctx context.Context, pageID uuid.UUID, links []domain.PageLinkInput) error
	ListLinksByPageID(ctx context.Context, pageID uuid.UUID) ([]domain.PageLink, error)
	GetPageConnectedLinks(ctx context.Context, pageID uuid.UUID) ([]domain.Page, []domain.PageLink, error)
}

type MentionRepository interface {
	ReplaceMentionByPageID(ctx context.Context, pageID uuid.UUID, mentions []domain.PageMentionInput) error
	ListMentionsByPageID(ctx context.Context, pageID uuid.UUID) ([]domain.Mention, error)
}

type TableRepository interface {
	ReplaceTableByPageID(ctx context.Context, pageID uuid.UUID, tables []domain.PageTableInput) error
	ListTablesByPageID(ctx context.Context, pageID uuid.UUID) ([]domain.Table, error)
}

type MediaRepository interface {
	ReplaceMediasByPageID(ctx context.Context, pageID uuid.UUID, media []domain.PageMediaInput) error
	ListMediasByPageID(ctx context.Context, pageID uuid.UUID) ([]domain.Media, error)
}
