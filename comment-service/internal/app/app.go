package app

import (
	"context"

	"github.com/flow-note/comment-service/internal/clients"
	"github.com/flow-note/comment-service/internal/config"
	grpcHandler "github.com/flow-note/comment-service/internal/handler/grpc"
	"github.com/flow-note/comment-service/internal/repository"
	"github.com/flow-note/comment-service/internal/service"
	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/broker"
	"github.com/flow-note/common/events"
	grpcruntime "github.com/flow-note/common/runtime/grpcserver"
	"github.com/flow-note/common/runtime/logging"
	"github.com/flow-note/common/runtime/postgres"
	commentv1 "github.com/flow-note/proto/comment/v1"
	"go.uber.org/zap"
	"google.golang.org/grpc"
)

type App struct {
	Config     config.Config
	Logger     *zap.Logger
	DB         *postgres.DB
	Broker     *broker.RabbitMQ
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
	repo := repository.NewPostgres(db)
	svc := service.New(db, repo, repo, repo, repo, repo, &directPublisher{bus: bus}, clients.StubPageAccessClient{})
	grpcSrv, err := grpcruntime.New(":"+cfg.GRPCPort, grpc.UnaryInterceptor(authctx.UnaryServerInterceptor()))
	if err != nil {
		return nil, err
	}
	commentv1.RegisterCommentServiceServer(grpcSrv.Inner(), grpcHandler.New(svc))
	return &App{
		Config:     cfg,
		Logger:     logger,
		DB:         db,
		Broker:     bus,
		GRPCServer: grpcSrv,
	}, nil
}

func (a *App) Close() {
	if a.Broker != nil {
		_ = a.Broker.Close()
	}
	if a.DB != nil {
		a.DB.Close()
	}
	if a.Logger != nil {
		_ = a.Logger.Sync()
	}
}

type directPublisher struct {
	bus *broker.RabbitMQ
}

func (p *directPublisher) Publish(ctx context.Context, envelope events.Envelope) error {
	return p.bus.Publish(ctx, envelope.RoutingKey(), envelope)
}
