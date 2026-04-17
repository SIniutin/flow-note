package main

import (
	"context"
	"os/signal"
	"syscall"

	"github.com/flow-note/media-service/config"
	"github.com/flow-note/media-service/internal/app"
	"go.uber.org/zap"
)

func main() {
	cfg := config.MustParse()

	logger, err := zap.NewProduction()
	if err != nil {
		panic(err)
	}
	defer func() {
		_ = logger.Sync()
	}()

	application, err := app.New(cfg, logger)
	if err != nil {
		logger.Fatal("failed to create app", zap.Error(err))
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err = application.Run(ctx); err != nil {
		logger.Fatal("application stopped with error", zap.Error(err))
	}
}
