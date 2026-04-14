package usecase

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"pages-service/internal/domain"
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

func (s *Service) ListPageMedia(ctx context.Context, credentials *domain.UserCredentials, pageID uuid.UUID) ([]domain.Media, error) {
	if !hasRequiredPermission(credentials.Role, domain.RoleViewer) {
		s.logger.Warn("ListPageMedia permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(domain.ErrPermissionDenied),
		)
		return nil, domain.ErrPermissionDenied
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
