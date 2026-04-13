package main

import (
	"context"
	"errors"
	"os"
	"os/signal"
	"syscall"

	"github.com/redkindanil/flow-note/notify-service/internal/app"
	"github.com/redkindanil/flow-note/notify-service/internal/config"
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
		if err := application.Consumer.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
			application.Logger.Error("consumer failed", zap.Error(err))
			stop()
		}
	}()

	<-ctx.Done()
	os.Exit(0)
}
