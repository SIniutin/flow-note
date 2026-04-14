package grpcauth

import (
	"context"
	"pages-service/common/authsecurity"

	"pages-service/common/authctx"
	"pages-service/common/httpauth"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func StreamAuthInterceptor(v authsecurity.Verifier, whitelist map[string]struct{}) grpc.StreamServerInterceptor {
	return func(
		srv any,
		ss grpc.ServerStream,
		info *grpc.StreamServerInfo,
		handler grpc.StreamHandler,
	) error {
		if IsWhitelisted(whitelist, info.FullMethod) {
			return handler(srv, ss)
		}

		ctx := ss.Context()

		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return status.Error(codes.Unauthenticated, "missing metadata")
		}

		auth := first(md.Get("authorization"))
		if auth == "" {
			return status.Error(codes.Unauthenticated, "missing authorization")
		}

		token := httpauth.ExtractBearer(auth)
		if token == "" {
			return status.Error(codes.Unauthenticated, "bad authorization")
		}

		userID, role, err := v.VerifyAccess(token)
		if err != nil {
			return status.Error(codes.Unauthenticated, "invalid token")
		}

		ctx = authctx.WithAuthInfo(ctx, authctx.AuthInfo{
			UserID: userID,
			Role:   role,
		})
		return handler(srv, &serverStreamWithContext{ServerStream: ss, ctx: ctx})
	}
}

type serverStreamWithContext struct {
	grpc.ServerStream
	ctx context.Context
}

func (w *serverStreamWithContext) Context() context.Context {
	return w.ctx
}
