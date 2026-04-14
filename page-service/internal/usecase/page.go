package usecase

import (
	"context"
	"strings"

	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/perm"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/flow-note/page-service/internal/domain"
)

func (s *Service) CreatePage(ctx context.Context, ownerId uuid.UUID, title string) (*domain.Page, error) {
	title = strings.TrimSpace(title)

	page, err := s.pageRepo.CreatePage(ctx, title, ownerId)
	if err != nil {
		s.logger.Error("CreatePage repository error",
			zap.String("owner_id", ownerId.String()),
			zap.String("title", title),
			zap.Error(err),
		)
		return nil, err
	}

	return page, nil
}

func (s *Service) GetPage(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID) (*domain.Page, error) {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleViewer) {
		s.logger.Warn("GetPage permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(perm.ErrViewerPermissionRequired),
		)
		return nil, perm.ErrViewerPermissionRequired
	}

	page, err := s.pageRepo.GetPage(ctx, pageID)
	if err != nil {
		s.logger.Error("GetPage repository error",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(err),
		)
		return nil, err
	}

	return page, nil
}

// TODO: transaction, and diff to config

func (s *Service) UpdatePage(ctx context.Context, pageID uuid.UUID, title string, size int64, keyToSnapshot string) (*domain.Page, error) {
	title = strings.TrimSpace(title)

	page, err := s.pageRepo.GetPage(ctx, pageID)
	if err != nil {
		s.logger.Error("UpdatePage get page error",
			zap.String("page_id", pageID.String()),
			zap.String("title", title),
			zap.Int64("size", size),
			zap.String("key_to_snapshot", keyToSnapshot),
			zap.Error(err),
		)
		return nil, err
	}

	var versionId = page.Version
	if size-page.Size > 1 {
		version, err := s.versionRepo.CreateVersion(ctx, pageID, size, keyToSnapshot)
		if err != nil {
			s.logger.Error("UpdatePage create version error",
				zap.String("page_id", pageID.String()),
				zap.String("title", title),
				zap.Int64("size", size),
				zap.String("key_to_snapshot", keyToSnapshot),
				zap.Error(err),
			)
			return nil, err
		}
		versionId = version.Id
	}

	page, err = s.pageRepo.UpdatePage(ctx, pageID, title, size, versionId)
	if err != nil {
		s.logger.Error("UpdatePage repository error",
			zap.String("page_id", pageID.String()),
			zap.String("title", title),
			zap.Int64("size", size),
			zap.Int64("version_id", versionId),
			zap.String("key_to_snapshot", keyToSnapshot),
			zap.Error(err),
		)
		return nil, err
	}

	return page, nil
}

func (s *Service) DeletePage(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID) error {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleOwner) {
		s.logger.Warn("DeletePage permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(perm.ErrOwnerPermissionRequired),
		)
		return perm.ErrOwnerPermissionRequired
	}

	err := s.pageRepo.DeletePage(ctx, pageID)
	if err != nil {
		s.logger.Error("DeletePage repository error",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(err),
		)
		return err
	}

	return nil
}

func (s *Service) ListMyPages(ctx context.Context, userId uuid.UUID, limit, offset int32) ([]domain.Page, error) {
	pages, err := s.pageRepo.ListPagesByOwnerID(ctx, userId, limit, offset)
	if err != nil {
		s.logger.Error("ListMyPages repository error",
			zap.String("user_id", userId.String()),
			zap.Int32("limit", limit),
			zap.Int32("offset", offset),
			zap.Error(err),
		)
		return nil, err
	}

	return pages, nil
}

func (s *Service) ListAllowedPages(ctx context.Context, userId uuid.UUID, limit, offset int32) ([]domain.Page, error) {
	pages, err := s.pageRepo.ListPagesAllowedByUserID(ctx, userId, limit, offset)
	if err != nil {
		s.logger.Error("ListAllowedPages repository error",
			zap.String("user_id", userId.String()),
			zap.Int32("limit", limit),
			zap.Int32("offset", offset),
			zap.Error(err),
		)
		return nil, err
	}

	return pages, nil
}
