package usecase

import (
	"context"

	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/broker"
	"github.com/flow-note/common/perm"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/flow-note/page-service/internal/domain"
)

func (s *Service) ReplacePageMentions(ctx context.Context, pageID uuid.UUID, mentions []domain.PageMentionInput) error {
	err := s.mentionRepo.ReplaceMentionByPageID(ctx, pageID, mentions)
	if err != nil {
		s.logger.Error("ReplacePageMentions repository error",
			zap.String("page_id", pageID.String()),
			zap.Int("mentions_count", len(mentions)),
			zap.Error(err),
		)
		return err
	}

	for _, m := range mentions {
		if err := s.rabbit.Publish(ctx, broker.Event{
			UserID:  m.UserID.String(),
			ActorID: "",
			PageID:  pageID.String(),
			Type:    broker.EventMentionPage,
		}); err != nil {
			s.logger.Warn("EventMentionPage publish failed", zap.Error(err))
		}
	}
	return nil
}

func (s *Service) ListPageMentions(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID) ([]domain.Mention, error) {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleViewer) {
		s.logger.Warn("ListPageMentions permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(perm.ErrViewerPermissionRequired),
		)
		return nil, perm.ErrViewerPermissionRequired
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
