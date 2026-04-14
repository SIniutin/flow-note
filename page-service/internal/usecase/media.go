package usecase

import (
	"context"

	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/perm"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/flow-note/page-service/internal/domain"
)

func (s *Service) ReplacePageMedia(ctx context.Context, pageID uuid.UUID, media []domain.PageMediaInput) error {
	err := s.mediaRepo.ReplaceMediasByPageID(ctx, pageID, media)
	if err != nil {
		s.logger.Error("ReplaceMediasByPageID repository error",
			zap.String("page_id", pageID.String()),
			zap.Int("media_count", len(media)),
			zap.Error(err))
		return err
	}

	return nil
}

func (s *Service) ListPageMedia(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID) ([]domain.Media, error) {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleViewer) {
		s.logger.Warn("ListPageMedia permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(perm.ErrPermissionDenied),
		)
		return nil, perm.ErrPermissionDenied
	}

	media, err := s.mediaRepo.ListMediasByPageID(ctx, pageID)
	if err != nil {
		s.logger.Error("ListPageMedia repository error",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(err),
		)
		return nil, err
	}

	return media, nil
}
