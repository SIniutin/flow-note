package authctx

import "context"

type key struct{}

type AuthInfo struct {
	UserID string
	Role   string
}

func WithAuthInfo(ctx context.Context, info AuthInfo) context.Context {
	return context.WithValue(ctx, key{}, info)
}

func AuthInfoFromContext(ctx context.Context) (AuthInfo, bool) {
	v := ctx.Value(key{})
	info, ok := v.(AuthInfo)
	return info, ok
}

func WithUserID(ctx context.Context, id string) context.Context {
	info, _ := AuthInfoFromContext(ctx)
	info.UserID = id
	return WithAuthInfo(ctx, info)
}

func UserID(ctx context.Context) (string, bool) {
	info, ok := AuthInfoFromContext(ctx)
	if !ok {
		return "", false
	}
	if info.UserID == "" {
		return "", false
	}
	return info.UserID, true
}

func WithRole(ctx context.Context, role string) context.Context {
	info, _ := AuthInfoFromContext(ctx)
	info.Role = role
	return WithAuthInfo(ctx, info)
}

func Role(ctx context.Context) (string, bool) {
	info, ok := AuthInfoFromContext(ctx)
	if !ok {
		return "", false
	}
	if info.Role == "" {
		return "", false
	}
	return info.Role, true
}
