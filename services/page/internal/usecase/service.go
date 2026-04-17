package usecase

import (
	"context"

	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/broker"
	"github.com/flow-note/common/perm"
	"github.com/flow-note/page-service/internal/repository"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/flow-note/page-service/internal/domain"
)

var _ PageUsecase = (*Service)(nil)
var _ VersionUsecase = (*Service)(nil)
var _ PermissionUsecase = (*Service)(nil)
var _ LinkUsecase = (*Service)(nil)
var _ MentionUsecase = (*Service)(nil)
var _ TableUsecase = (*Service)(nil)
var _ MediaUsecase = (*Service)(nil)

type PageUsecase interface {
	CreatePage(ctx context.Context, ownerId uuid.UUID, title string) (*domain.Page, error)
	GetPage(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID) (*domain.Page, error)
	UpdatePage(ctx context.Context, pageID uuid.UUID, title string, size int64, keyToSnapshot string) (*domain.Page, error)
	DeletePage(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID) error
	ListMyPages(ctx context.Context, userId uuid.UUID, limit, offset int32) ([]domain.Page, error)
	ListAllowedPages(ctx context.Context, userId uuid.UUID, limit, offset int32) ([]domain.Page, error)
}

type VersionUsecase interface {
	GetCurrentVersion(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID, versionId int64) (*domain.Version, error)
	GetLastVersion(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID) (*domain.Version, error)
	ListVersions(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID, limit, offset int32) ([]domain.Version, error)
}

type PermissionUsecase interface {
	GrantPagePermission(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID, userID uuid.UUID, role perm.PermissionRole) (*domain.Permission, error)
	RevokePagePermission(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID, userID uuid.UUID) error
	ListPagePermissions(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID) ([]domain.Permission, error)
	GetMyPagePermission(ctx context.Context, userId uuid.UUID, pageID uuid.UUID) (*domain.Permission, error)
}

type LinkUsecase interface {
	ReplacePageLinks(ctx context.Context, pageID uuid.UUID, links []domain.PageLinkInput) error
	GetPageConnectedLinks(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID) ([]domain.Page, []domain.PageLink, error)
}

type MentionUsecase interface {
	ReplacePageMentions(ctx context.Context, pageID uuid.UUID, mentions []domain.PageMentionInput) error
	ListPageMentions(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID) ([]domain.Mention, error)
}

type TableUsecase interface {
	ReplacePageTables(ctx context.Context, pageID uuid.UUID, tables []domain.PageTableInput) error
	ListPageTables(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID) ([]domain.Table, error)
}

type MediaUsecase interface {
	ReplacePageMedia(ctx context.Context, pageID uuid.UUID, media []domain.PageMediaInput) error
	ListPageMedia(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID) ([]domain.Media, error)
}

type Service struct {
	logger         *zap.Logger
	rabbit         *broker.RabbitMQ
	pageRepo       repository.PageRepository
	versionRepo    repository.VersionRepository
	permissionRepo repository.PermissionRepository
	linkRepo       repository.LinkRepository
	mentionRepo    repository.MentionRepository
	tableRepo      repository.TableRepository
	mediaRepo      repository.MediaRepository
}

func NewService(
	logger *zap.Logger,
	rabbit *broker.RabbitMQ,
	pageRepo repository.PageRepository,
	versionRepo repository.VersionRepository,
	permissionRepo repository.PermissionRepository,
	linkRepo repository.LinkRepository,
	mentionRepo repository.MentionRepository,
	tableRepo repository.TableRepository,
	mediaRepo repository.MediaRepository,
) *Service {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &Service{
		logger:         logger,
		rabbit:         rabbit,
		pageRepo:       pageRepo,
		versionRepo:    versionRepo,
		permissionRepo: permissionRepo,
		linkRepo:       linkRepo,
		mentionRepo:    mentionRepo,
		tableRepo:      tableRepo,
		mediaRepo:      mediaRepo,
	}
}
