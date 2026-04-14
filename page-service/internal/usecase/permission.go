package usecase

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/flow-note/page-service/internal/domain"
)

func (s *Service) GrantPagePermission(ctx context.Context, credentials *domain.UserCredentials, pageID uuid.UUID, userID uuid.UUID, role domain.PermissionRole) (*domain.Permission, error) {
	if !hasRequiredPermission(credentials.Role, domain.RoleMentor) {
		s.logger.Warn("GrantPagePermission permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("actor_user_id", credentials.UserId.String()),
			zap.String("target_user_id", userID.String()),
			zap.String("actor_role", string(credentials.Role)),
			zap.String("target_role", string(role)),
			zap.Error(domain.ErrMentorPermissionRequired),
		)
		return nil, domain.ErrMentorPermissionRequired
	}

	if role == domain.RoleOwner {
		s.logger.Warn("GrantPagePermission forbidden owner assignment",
			zap.String("page_id", pageID.String()),
			zap.String("actor_user_id", credentials.UserId.String()),
			zap.String("target_user_id", userID.String()),
			zap.String("actor_role", string(credentials.Role)),
			zap.String("target_role", string(role)),
			zap.Error(domain.ErrPermissionDenied),
		)
		return nil, domain.ErrPermissionDenied
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

	return permission, nil
}

func (s *Service) RevokePagePermission(ctx context.Context, credentials *domain.UserCredentials, pageID uuid.UUID, userID uuid.UUID) error {
	if !hasRequiredPermission(credentials.Role, domain.RoleMentor) {
		s.logger.Warn("RevokePagePermission permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("actor_user_id", credentials.UserId.String()),
			zap.String("target_user_id", userID.String()),
			zap.String("actor_role", string(credentials.Role)),
			zap.Error(domain.ErrMentorPermissionRequired),
		)
		return domain.ErrMentorPermissionRequired
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

	return nil
}

func (s *Service) ListPagePermissions(ctx context.Context, credentials *domain.UserCredentials, pageID uuid.UUID) ([]domain.Permission, error) {
	if !hasRequiredPermission(credentials.Role, domain.RoleMentor) {
		s.logger.Warn("ListPagePermissions permission denied",
			zap.String("page_id", pageID.String()),
			zap.String("user_id", credentials.UserId.String()),
			zap.String("role", string(credentials.Role)),
			zap.Error(domain.ErrMentorPermissionRequired),
		)
		return nil, domain.ErrMentorPermissionRequired
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
