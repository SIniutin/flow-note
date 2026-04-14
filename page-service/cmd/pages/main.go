package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"

	appconfig "pages-service/config"
	"pages-service/internal/app"
)

func main() {
	ctx := context.Background()

	cfg := appconfig.MustLoad()

	logger, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("failed to init logger: %v", err)
	}
	defer func() {
		_ = logger.Sync()
	}()

	application, err := app.New(ctx, logger, cfg)
	if err != nil {
		logger.Fatal("failed to init app", zap.Error(err))
	}

	go func() {
		logger.Info("app started", zap.String("grpc_port", cfg.GRPC.Port), zap.String("http_port", cfg.HTTP.Port))
		if err := application.Run(); err != nil {
			logger.Fatal("app run error", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := application.Shutdown(shutdownCtx); err != nil {
		logger.Fatal("shutdown error", zap.Error(err))
	}

	logger.Info("graceful shutdown complete")
}
