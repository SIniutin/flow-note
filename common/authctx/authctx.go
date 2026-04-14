package authctx

import (
	"context"

	"github.com/flow-note/common/perm"
	"github.com/google/uuid"
)

type key struct{}

type AuthInfo struct {
	UserID string
	Role   string
}

type UserCredentials struct {
	UserId uuid.UUID
	Role   perm.PermissionRole
}

func WithAuthInfo(ctx context.Context, info AuthInfo) context.Context {
	return context.WithValue(ctx, key{}, info)
}

func AuthInfoFromContext(ctx context.Context) (AuthInfo, bool) {
	v := ctx.Value(key{})
	info, ok := v.(AuthInfo)
	return info, ok
}

func ParseUserIDAndPermissionRole(ctx context.Context) (*UserCredentials, error) {
	userId, err := ParseUserIDFromCtx(ctx)
	if err != nil {
		return nil, err
	}

	userRole, err := ParseUserRoleFromCtx(ctx)
	if err != nil {
		return nil, err
	}

	return &UserCredentials{
		UserId: userId,
		Role:   userRole,
	}, nil
}

func ParseUserIDFromCtx(ctx context.Context) (uuid.UUID, error) {
	authInfo, ok := AuthInfoFromContext(ctx)
	if !ok {
		return uuid.Nil, ErrMissingUserIDInContext
	}
	if authInfo.UserID == "" {
		return uuid.Nil, ErrMissingUserIDInContext
	}

	userID, err := uuid.Parse(authInfo.UserID)
	if err != nil {
		return uuid.Nil, ErrInvalidUserIDInContext
	}

	return userID, nil
}

func ParseUserRoleFromCtx(ctx context.Context) (perm.PermissionRole, error) {
	authInfo, ok := AuthInfoFromContext(ctx)
	if !ok {
		return "", ErrMissingUserRoleInContext
	}

	role := perm.PermissionRole(authInfo.Role)
	ok = isValidPermissionRole(role)
	if !ok {
		return "", ErrInvalidUserRoleInContext
	}

	return role, nil
}

func isValidPermissionRole(role perm.PermissionRole) bool {
	switch role {
	case "owner", "editor", "viewer", "mentor", "commenter":
		return true
	default:
		return false
	}
}
