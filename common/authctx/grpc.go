package authctx

import (
	"context"

	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

func UnaryServerInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		md, ok := metadata.FromIncomingContext(ctx)
		if ok {
			values := md.Get("x-user-id")
			if len(values) > 0 {
				if userID, err := uuid.Parse(values[0]); err == nil {
					ctx = WithUserID(ctx, userID)
				}
			}
		}
		return handler(ctx, req)
	}
}
