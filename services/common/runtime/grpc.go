package runtime

import (
	"context"
	"fmt"
	"net"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

func ServeGRPC(
	addr string,
	register func(*grpc.Server),
	enableReflection bool,
	opts ...grpc.ServerOption,
) error {
	return ServeGRPCWithContext(context.Background(), addr, register, enableReflection, opts...)
}

func ServeGRPCWithContext(
	ctx context.Context,
	addr string,
	register func(*grpc.Server),
	enableReflection bool,
	opts ...grpc.ServerOption,
) error {
	server := grpc.NewServer(opts...)
	register(server)

	if enableReflection {
		reflection.Register(server)
	}

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen grpc: %w", err)
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Serve(lis)
	}()

	select {
	case <-ctx.Done():
		done := make(chan struct{})
		go func() {
			server.GracefulStop()
			close(done)
		}()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			server.Stop()
		}
		return nil
	case err := <-errCh:
		if err == nil {
			return nil
		}
		return fmt.Errorf("serve grpc: %w", err)
	}
}
