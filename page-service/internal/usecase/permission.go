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

func (s *Service) GrantPagePermission(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID, userID uuid.UUID, role perm.PermissionRole) (*domain.Permission, error) {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleMentor) {
		s.logger.Warn("GrantPagePermission permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("actor_user_id", credentials.UserId.String()),
			zap.String("target_user_id", userID.String()),
			zap.String("actor_role", string(credentials.Role)),
			zap.String("target_role", string(role)),
			zap.Error(perm.ErrMentorPermissionRequired),
		)
		return nil, perm.ErrMentorPermissionRequired
	}

	if role == perm.RoleOwner {
		s.logger.Warn("GrantPagePermission forbidden owner assignment",
			zap.String("page_id", pageID.String()),
			zap.String("actor_user_id", credentials.UserId.String()),
			zap.String("target_user_id", userID.String()),
			zap.String("actor_role", string(credentials.Role)),
			zap.String("target_role", string(role)),
			zap.Error(perm.ErrPermissionDenied),
		)
		return nil, perm.ErrPermissionDenied
	}

	permission, err := s.permissionRepo.CreatePermission(ctx, pageID, userID, role)
	if err != nil {
		s.logger.Error("GrantPagePermission repository error",
			zap.String("page_id", pageID.String()),
			zap.String("actor_user_id", credentials.UserId.String()),
			zap.String("target_user_id", userID.String()),
			zap.String("actor_role", string(credentials.Role)),
			zap.String("target_role", string(role)),
			zap.Error(err),
		)
		return nil, err
	}

	if err := s.rabbit.Publish(ctx, broker.Event{
		UserID:  userID.String(),
		ActorID: credentials.UserId.String(),
		PageID:  pageID.String(),
		Type:    broker.EventGrandPermission,
	}); err != nil {
		s.logger.Warn("GrantPagePermission publish failed", zap.Error(err))
	}
	return permission, nil
}

func (s *Service) RevokePagePermission(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID, userID uuid.UUID) error {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleMentor) {
		s.logger.Warn("RevokePagePermission permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("actor_user_id", credentials.UserId.String()),
			zap.String("target_user_id", userID.String()),
			zap.String("actor_role", string(credentials.Role)),
			zap.Error(perm.ErrMentorPermissionRequired),
		)
		return perm.ErrMentorPermissionRequired
	}

	err := s.permissionRepo.DeletePermission(ctx, pageID, userID)
	if err != nil {
		s.logger.Error("RevokePagePermission repository error",
			zap.String("page_id", pageID.String()),
			zap.String("actor_user_id", credentials.UserId.String()),
			zap.String("target_user_id", userID.String()),
			zap.String("actor_role", string(credentials.Role)),
			zap.Error(err),
		)
		return err
	}

	if err := s.rabbit.Publish(ctx, broker.Event{
		UserID:  userID.String(),
		ActorID: credentials.UserId.String(),
		PageID:  pageID.String(),
		Type:    broker.EventRevokePermission,
	}); err != nil {
		s.logger.Warn("EventRevokePermission publish failed", zap.Error(err))
	}
	return nil
}

func (s *Service) ListPagePermissions(ctx context.Context, credentials *authctx.UserCredentials, pageID uuid.UUID) ([]domain.Permission, error) {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleViewer) {
		s.logger.Warn("ListPagePermissions permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(perm.ErrViewerPermissionRequired),
		)
		return nil, perm.ErrMentorPermissionRequired
	}

	permissions, err := s.permissionRepo.ListPermissionByPageID(ctx, pageID)
	if err != nil {
		s.logger.Error("ListPagePermissions repository error",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(err),
		)
		return nil, err
	}

	return permissions, nil
}

func (s *Service) GetMyPagePermission(ctx context.Context, userID uuid.UUID, pageID uuid.UUID) (*domain.Permission, error) {
	permission, err := s.permissionRepo.GetByPageIDAndUserID(ctx, pageID, userID)
	if err != nil {
		s.logger.Error("GetMyPagePermission repository error",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", userID.String()),
			zap.Error(err),
		)
		return nil, err
	}

	return permission, nil
}
