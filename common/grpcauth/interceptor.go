package grpcauth

import (
	"context"

	"github.com/flow-note/common/authsecurity"

	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/httpauth"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func UnaryAuthInterceptor(v authsecurity.Verifier, whitelist map[string]struct{}) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req any,
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (any, error) {
		if IsWhitelisted(whitelist, info.FullMethod) {
			return handler(ctx, req)
		}
		println(info.FullMethod)
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, status.Error(codes.Unauthenticated, "missing metadata")
		}

		auth := first(md.Get("authorization"))
		if auth == "" {
			return nil, status.Error(codes.Unauthenticated, "missing authorization")
		}

		token := httpauth.ExtractBearer(auth)
		if token == "" {
			return nil, status.Error(codes.Unauthenticated, "bad authorization")
		}

		userID, role, err := v.VerifyAccess(token)
		if err != nil {
			return nil, status.Error(codes.Unauthenticated, "invalid token")
		}
		ctx = authctx.WithAuthInfo(ctx, authctx.AuthInfo{
			UserID: userID,
			Role:   role,
		})
		return handler(ctx, req)
	}
}

func first(v []string) string {
	if len(v) == 0 {
		return ""
	}
	return v[0]
}
