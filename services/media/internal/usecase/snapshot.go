package usecase

import (
	"context"

	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/perm"
	"github.com/flow-note/media-service/internal/domain"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

func (s *mediaService) GetLatestSnapshotDownloadURL(
	ctx context.Context,
	userCredentials *authctx.UserCredentials,
	pageID uuid.UUID,
) (*domain.DownloadURL, error) {
	if !perm.HasRequiredPermission(userCredentials.Role, perm.RoleViewer) {
		s.logger.Warn("GetLatestSnapshotDownloadURL permission denied",
			zap.String("page_id", pageID.String()))
		return nil, perm.ErrViewerPermissionRequired
	}

	url, err := s.snapshotRepo.GetLatestSnapshotDownloadURL(ctx, pageID)
	if err != nil {
		s.logger.Warn("GetLatestSnapshotDownloadURL failed", zap.Error(err))
		return nil, err
	}

	return url, nil
}

func (s *mediaService) GetSnapshotDownloadURL(
	ctx context.Context,
	userCredentials *authctx.UserCredentials,
	pageID uuid.UUID,
	versionID string,
) (*domain.DownloadURL, error) {
	if !perm.HasRequiredPermission(userCredentials.Role, perm.RoleViewer) {
		s.logger.Warn("GetLatestSnapshotDownloadURL permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("version_id", versionID))
		return nil, perm.ErrViewerPermissionRequired
	}

	url, err := s.snapshotRepo.GetSnapshotDownloadURL(ctx, pageID, versionID)
	if err != nil {
		s.logger.Warn("GetLatestSnapshotDownloadURL failed", zap.Error(err))
		return nil, err
	}

	return url, nil
}
