package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/flow-note/comment-service/internal/app"
	"github.com/flow-note/comment-service/internal/config"
	"go.uber.org/zap"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg := config.Load()
	application, err := app.New(ctx, cfg)
	if err != nil {
		panic(err)
	}
	defer application.Close()

	go func() {
		if err := application.GRPCServer.Serve(); err != nil {
			application.Logger.Error("grpc server failed", zap.Error(err))
			stop()
		}
	}()

	<-ctx.Done()
	application.GRPCServer.GracefulStop()
	os.Exit(0)
}
