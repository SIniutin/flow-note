package handler

import (
	"context"
	"time"

	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/perm"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func mustParseUUID(raw string) uuid.UUID {
	return uuid.MustParse(raw)
}

// resolvePageCredentials fetches the calling user's page-level role from the
// database. Used instead of authctx.ParseUserIDAndPermissionRole because the
// JWT issued by auth-service does not carry page-level roles.
func (h *pagesHandler) resolvePageCredentials(ctx context.Context, pageID uuid.UUID) (*authctx.UserCredentials, error) {
	userID, err := authctx.ParseUserIDFromCtx(ctx)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, err.Error())
	}

	p, err := h.permissionUsecase.GetMyPagePermission(ctx, userID, pageID)
	if err != nil {
		return nil, status.Error(codes.PermissionDenied, "no permission for this page")
	}

	return &authctx.UserCredentials{
		UserId: userID,
		Role:   perm.PermissionRole(p.Role),
	}, nil
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
