package usecase

import (
	"context"

	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/perm"
	"github.com/google/uuid"

	"go.uber.org/zap"

	"github.com/flow-note/page-service/internal/domain"
)

func (s *Service) ReplacePageLinks(ctx context.Context, pageID uuid.UUID, links []domain.PageLinkInput) error {
	err := s.linkRepo.ReplaceLinksByPageID(ctx, pageID, links)
	if err != nil {
		s.logger.Error("failed to replace links",
			zap.String("pageID", pageID.String()),
			zap.Int("links_count", len(links)),
			zap.Error(err))
		return err
	}

	return nil
}

func (s *Service) GetPageConnectedLinks(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID) ([]domain.Page, []domain.PageLink, error) {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleViewer) {
		s.logger.Warn("GetPageConnectedLinks permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(perm.ErrViewerPermissionRequired),
		)
		return nil, nil, perm.ErrViewerPermissionRequired
	}

	pages, links, err := s.linkRepo.GetPageConnectedLinks(ctx, pageID)
	if err != nil {
		s.logger.Error("GetPageConnectedLinks repository error",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(err),
		)
		return nil, nil, err
	}

	return pages, links, nil
}
