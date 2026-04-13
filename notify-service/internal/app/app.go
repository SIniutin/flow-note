package app

import (
	"context"

	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/broker"
	commonrt "github.com/flow-note/common/realtime"
	grpcruntime "github.com/flow-note/common/runtime/grpcserver"
	"github.com/flow-note/common/runtime/logging"
	"github.com/flow-note/common/runtime/postgres"
	"github.com/flow-note/notify-service/internal/config"
	"github.com/flow-note/notify-service/internal/consumer"
	"github.com/flow-note/notify-service/internal/repository"
	"github.com/flow-note/notify-service/internal/service"
	grpcHandler "github.com/flow-note/notify-service/internal/transport/grpc"
	notifyv1 "github.com/flow-note/proto/notify/v1"
	"go.uber.org/zap"
	"google.golang.org/grpc"
)

type App struct {
	Config     config.Config
	Logger     *zap.Logger
	DB         *postgres.DB
	Broker     *broker.RabbitMQ
	Realtime   *commonrt.RedisPublisher
	Consumer   *consumer.Consumer
	GRPCServer *grpcruntime.Server
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
	grpcSrv, err := grpcruntime.New(":"+cfg.GRPCPort, grpc.UnaryInterceptor(authctx.UnaryServerInterceptor()))
	if err != nil {
		return nil, err
	}
	notifyv1.RegisterNotifyServiceServer(grpcSrv.Inner(), grpcHandler.New(svc, realtimePub))
	return &App{
		Config:     cfg,
		Logger:     logger,
		DB:         db,
		Broker:     bus,
		Realtime:   realtimePub,
		Consumer:   consumerWorker,
		GRPCServer: grpcSrv,
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
