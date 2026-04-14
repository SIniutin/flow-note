package usecase

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"pages-service/internal/domain"
)

func (s *Service) ReplacePageMentions(ctx context.Context, pageID uuid.UUID, mentions []domain.PageMentionInput) error {
	// TODO: to Notify

	err := s.mentionRepo.ReplaceMentionByPageID(ctx, pageID, mentions)
	if err != nil {
		s.logger.Error("ReplacePageMentions repository error",
			zap.String("page_id", pageID.String()),
			zap.Int("mentions_count", len(mentions)),
			zap.Error(err),
		)
		return err
	}

	return nil
}

func (s *Service) ListPageMentions(ctx context.Context, credentials *domain.UserCredentials, pageID uuid.UUID) ([]domain.Mention, error) {
	if !hasRequiredPermission(credentials.Role, domain.RoleViewer) {
		s.logger.Warn("ListPageMentions permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(domain.ErrViewerPermissionRequired),
		)
		return nil, domain.ErrViewerPermissionRequired
	}

	mentions, err := s.mentionRepo.ListMentionsByPageID(ctx, pageID)
	if err != nil {
		s.logger.Error("ListPageMentions repository error",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(err),
		)
		return nil, err
	}

	return mentions, nil
}
