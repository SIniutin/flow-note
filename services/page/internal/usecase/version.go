package usecase

import (
	"context"

	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/perm"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/flow-note/page-service/internal/domain"
)

func (s *Service) GetCurrentVersion(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID, versionId int64) (*domain.Version, error) {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleViewer) {
		s.logger.Warn("GetCurrentVersion permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Int64("version_id", versionId),
			zap.Error(perm.ErrViewerPermissionRequired),
		)
		return nil, perm.ErrViewerPermissionRequired
	}

	version, err := s.versionRepo.GetCurrentVersion(ctx, pageID, versionId)
	if err != nil {
		s.logger.Error("GetCurrentVersion repository error",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Int64("version_id", versionId),
			zap.Error(err),
		)
		return nil, err
	}

	return version, nil
}

func (s *Service) GetLastVersion(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID) (*domain.Version, error) {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleViewer) {
		s.logger.Warn("GetLastVersion permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(perm.ErrViewerPermissionRequired),
		)
		return nil, perm.ErrViewerPermissionRequired
	}

	version, err := s.versionRepo.GetLastVersion(ctx, pageID)
	if err != nil {
		s.logger.Error("GetLastVersion repository error",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(err),
		)
		return nil, err
	}

	return version, nil
}

func (s *Service) ListVersions(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID, limit, offset int32) ([]domain.Version, error) {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleViewer) {
		s.logger.Warn("ListVersions permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Int32("limit", limit),
			zap.Int32("offset", offset),
			zap.Error(perm.ErrViewerPermissionRequired),
		)
		return nil, perm.ErrViewerPermissionRequired
	}

	versions, err := s.versionRepo.ListVersions(ctx, pageID, limit, offset)
	if err != nil {
		s.logger.Error("ListVersions repository error",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Int32("limit", limit),
			zap.Int32("offset", offset),
			zap.Error(err),
		)
		return nil, err
	}

	return versions, nil
}
