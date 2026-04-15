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

	ok = isValidPermissionRole(authInfo.Role)
	println(ok, authInfo.Role)
	if !ok {
		return "", ErrInvalidUserRoleInContext
	}

	return MapRoleFromProto(authInfo.Role), nil
}

func isValidPermissionRole(role string) bool {
	switch role {
	case "PAGE_PERMISSION_ROLE_OWNER", "PAGE_PERMISSION_ROLE_EDITOR", "PAGE_PERMISSION_ROLE_VIEWER", "PAGE_PERMISSION_ROLE_MENTOR", "PAGE_PERMISSION_ROLE_COMMENTER":
		return true
	default:
		return false
	}
}

var protoToDomainRole = map[string]perm.PermissionRole{
	"PAGE_PERMISSION_ROLE_VIEWER":      perm.RoleViewer,
	"PAGE_PERMISSION_ROLE_COMMENTER":   perm.RoleCommenter,
	"PAGE_PERMISSION_ROLE_EDITOR":      perm.RoleEditor,
	"PAGE_PERMISSION_ROLE_MENTOR":      perm.RoleMentor,
	"PAGE_PERMISSION_ROLE_OWNER":       perm.RoleOwner,
	"PAGE_PERMISSION_ROLE_UNSPECIFIED": perm.RoleUnspecified,
}

func MapRoleFromProto(role string) perm.PermissionRole {
	domainRole, _ := protoToDomainRole[role]

	return domainRole
}
