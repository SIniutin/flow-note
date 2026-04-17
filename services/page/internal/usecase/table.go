package usecase

import (
	"context"

	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/perm"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/flow-note/page-service/internal/domain"
)

func (s *Service) ReplacePageTables(ctx context.Context, pageID uuid.UUID, tables []domain.PageTableInput) error {
	err := s.tableRepo.ReplaceTableByPageID(ctx, pageID, tables)
	if err != nil {
		s.logger.Error("ReplacePageTables repository error",
			zap.String("page_id", pageID.String()),
			zap.Int("tables_count", len(tables)),
			zap.Error(err),
		)
		return err
	}

	return nil
}

func (s *Service) ListPageTables(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID) ([]domain.Table, error) {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleViewer) {
		s.logger.Warn("ListPageTables permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(perm.ErrViewerPermissionRequired),
		)
		return nil, perm.ErrViewerPermissionRequired
	}

	tables, err := s.tableRepo.ListTablesByPageID(ctx, pageID)
	if err != nil {
		s.logger.Error("ListPageTables repository error",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(err),
		)
		return nil, err
	}

	return tables, nil
}
