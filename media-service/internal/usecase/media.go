package usecase

import (
	"context"

	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/perm"
	"github.com/flow-note/media-service/internal/domain"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

func (s *mediaService) GetMediaDownloadURL(
	ctx context.Context,
	userCredentials *authctx.UserCredentials,
	pageID uuid.UUID,
	mediaID uuid.UUID,
) (*domain.DownloadURL, error) {
	if !perm.HasRequiredPermission(userCredentials.Role, perm.RoleViewer) {
		s.logger.Warn("GetMediaDownloadURL permission denied",
			zap.String("page id", pageID.String()),
			zap.String("media id", mediaID.String()))
		return nil, perm.ErrViewerPermissionRequired
	}

	url, err := s.mediaRepo.GetMediaDownloadURL(ctx, pageID, mediaID)
	if err != nil {
		s.logger.Error("failed to get media download url", zap.Error(err))
		return nil, err
	}

	return url, nil
}

func (s *mediaService) GetMediaUploadURL(
	ctx context.Context,
	userCredentials *authctx.UserCredentials,
	pageID uuid.UUID,
) (*domain.UploadURL, error) {
	if !perm.HasRequiredPermission(userCredentials.Role, perm.RoleEditor) {
		s.logger.Warn("GetMediaUploadURL permission denied",
			zap.String("page id", pageID.String()))
		return nil, perm.ErrEditorPermissionRequired
	}

	url, err := s.mediaRepo.GetMediaUploadURL(ctx, pageID)
	if err != nil {
		s.logger.Error("failed to get media upload url", zap.Error(err))
		return nil, err
	}

	return url, nil
}
