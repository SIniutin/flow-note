package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redkindanil/flow-note/comment-service/internal/app"
	"github.com/redkindanil/flow-note/comment-service/internal/config"
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

	go func() {
		if err := application.HTTPServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			application.Logger.Error("infra http server failed", zap.Error(err))
			stop()
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = application.HTTPServer.Shutdown(shutdownCtx)
	application.GRPCServer.GracefulStop()
	os.Exit(0)
}
