package handler

import (
	"context"
	"pages-service/common/authctx"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"pages-service/internal/domain"
)

func mustParseUUID(raw string) uuid.UUID {
	return uuid.MustParse(raw)
}

func parseUserIDAndPermissionRole(ctx context.Context) (*domain.UserCredentials, error) {
	userId, err := parseUserIDFromCtx(ctx)
	if err != nil {
		return nil, err
	}

	userRole, err := parseUserRoleFromCtx(ctx)
	if err != nil {
		return nil, err
	}

	return &domain.UserCredentials{
		UserId: userId,
		Role:   userRole,
	}, nil
}

func parseUserIDFromCtx(ctx context.Context) (uuid.UUID, error) {
	authInfo, ok := authctx.AuthInfoFromContext(ctx)
	if !ok {
		return uuid.Nil, domain.ErrMissingUserIDInContext
	}
	if authInfo.UserID == "" {
		return uuid.Nil, domain.ErrMissingUserIDInContext
	}

	userID, err := uuid.Parse(authInfo.UserID)
	if err != nil {
		return uuid.Nil, domain.ErrInvalidUserIDInContext
	}

	return userID, nil
}

func parseUserRoleFromCtx(ctx context.Context) (domain.PermissionRole, error) {
	authInfo, ok := authctx.AuthInfoFromContext(ctx)
	if !ok {
		return "", domain.ErrMissingUserRoleInContext
	}

	role := domain.PermissionRole(authInfo.Role)
	ok = isValidPermissionRole(role)
	if !ok {
		return "", domain.ErrInvalidUserRoleInContext
	}

	return role, nil
}

func isValidPermissionRole(role domain.PermissionRole) bool {
	switch role {
	case "owner", "editor", "viewer", "mentor", "commenter":
		return true
	default:
		return false
	}
}

func (h *pagesHandler) logIn(method string, fields ...zap.Field) {
	if h.logger == nil {
		return
	}
	h.logger.Info("handler input", append([]zap.Field{zap.String("method", method)}, fields...)...)
}

func (h *pagesHandler) logOut(method string, startedAt time.Time, fields ...zap.Field) {
	if h.logger == nil {
		return
	}
	base := []zap.Field{
		zap.String("method", method),
		zap.Duration("duration", time.Since(startedAt)),
	}
	h.logger.Info("handler output", append(base, fields...)...)
}

func (h *pagesHandler) logWarn(method string, startedAt time.Time, err error, fields ...zap.Field) {
	if h.logger == nil {
		return
	}
	base := []zap.Field{
		zap.String("method", method),
		zap.Duration("duration", time.Since(startedAt)),
		zap.Error(err),
	}
	h.logger.Warn("handler error", append(base, fields...)...)
}
