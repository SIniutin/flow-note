package app

import (
	"context"

	"github.com/redkindanil/flow-note/common/broker"
	commonrt "github.com/redkindanil/flow-note/common/realtime"
	"github.com/redkindanil/flow-note/common/runtime/logging"
	"github.com/redkindanil/flow-note/common/runtime/postgres"
	"github.com/redkindanil/flow-note/notify-service/internal/config"
	"github.com/redkindanil/flow-note/notify-service/internal/consumer"
	"github.com/redkindanil/flow-note/notify-service/internal/repository"
	"github.com/redkindanil/flow-note/notify-service/internal/service"
	"go.uber.org/zap"
)

type App struct {
	Config   config.Config
	Logger   *zap.Logger
	DB       *postgres.DB
	Broker   *broker.RabbitMQ
	Realtime *commonrt.RedisPublisher
	Consumer *consumer.Consumer
}

func New(ctx context.Context, cfg config.Config) (*App, error) {
	logger, err := logging.New(cfg.LogLevel)
	if err != nil {
		return nil, err
	}
	db, err := postgres.New(ctx, cfg.PostgresDSN)
	if err != nil {
		return nil, err
	}
	bus, err := broker.NewRabbitMQ(cfg.BrokerURL, cfg.BrokerExchange)
	if err != nil {
		return nil, err
	}
	if err := bus.DeclareAndBind(cfg.BrokerQueue, []string{
		"comment.thread.created", 
		"comment.created", 
		"comment.reply.created", 
		"comment.mention.created", 
		"page.mention.created",
	}); err != nil {
		return nil, err
	}
	realtimePub := commonrt.NewRedisPublisher(cfg.RedisAddr)
	repo := repository.NewPostgres(db)
	svc := service.New(repo, realtimePub)
	consumerWorker := consumer.New(bus, cfg.BrokerQueue, svc)
	return &App{
		Config:   cfg,
		Logger:   logger,
		DB:       db,
		Broker:   bus,
		Realtime: realtimePub,
		Consumer: consumerWorker,
	}, nil
}

func (a *App) Close() {
	if a.Broker != nil {
		_ = a.Broker.Close()
	}
	if a.Realtime != nil {
		_ = a.Realtime.Close()
	}
	if a.DB != nil {
		a.DB.Close()
	}
	if a.Logger != nil {
		_ = a.Logger.Sync()
	}
}
