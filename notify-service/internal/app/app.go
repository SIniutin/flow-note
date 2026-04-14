package app

import (
	"context"
	"net"

	notificationsv1 "github.com/flow-note/api-contracts/generated/proto/notify/v1"
	"github.com/flow-note/common/authsecurity"
	"github.com/flow-note/common/broker"
	"github.com/flow-note/common/grpcauth"
	commonpg "github.com/flow-note/common/postgres"
	commonrt "github.com/flow-note/common/realtime"
	cr "github.com/flow-note/common/runtime"
	migrate "github.com/flow-note/notify-service/db"
	"github.com/flow-note/notify-service/internal/config"
	"github.com/flow-note/notify-service/internal/infra/consumer"
	pgAdapter "github.com/flow-note/notify-service/internal/infra/postgres"
	grpcAdapter "github.com/flow-note/notify-service/internal/transport/grpc"
	"github.com/flow-note/notify-service/internal/usecase"
	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

// App wires together all components and manages their lifecycle.
type App struct {
	Config   config.Config
	Logger   *zap.Logger
	db       *commonpg.DB
	realtime *commonrt.RedisPublisher
	rmq      *broker.RabbitMQ
	server   *grpc.Server
	listener net.Listener
	consumer *consumer.Consumer
}

func New(cfg config.Config) (*App, error) {
	logger, _, err := cr.NewLogger()
	if err != nil {
		return nil, err
	}

	if err := migrate.Up(context.Background(), cfg.PostgresDSN); err != nil {
		logger.Warn("migration failed — continuing", zap.Error(err))
	}

	db, err := commonpg.New(context.Background(), cfg.PostgresDSN)
	if err != nil {
		return nil, err
	}

	rt := commonrt.NewRedisPublisher(cfg.RedisAddr)

	rmq, err := broker.NewRabbitMQ(cfg.BrokerURL, cfg.BrokerExchange)
	if err != nil {
		db.Close()
		_ = rt.Close()
		return nil, err
	}

	repo := pgAdapter.NewRepository(db)

	getNotifications := usecase.NewGetNotifications(repo)
	markRead := usecase.NewMarkRead(repo)
	markAllRead := usecase.NewMarkAllRead(repo)
	processEvent := usecase.NewProcessEvent(repo, rt)

	amqpConsumer := consumer.New(rmq, cfg.BrokerQueue, processEvent)

	unaryInterceptors := []grpc.UnaryServerInterceptor{cr.RecoveryUnaryServerInterceptor(logger)}
	streamInterceptors := []grpc.StreamServerInterceptor{cr.RecoveryStreamServerInterceptor(logger)}

	if cfg.JWTPublicKeyPEM != "" {
		pub, err := authsecurity.LoadRSAPublicKeyFromPEMFile(cfg.JWTPublicKeyPEM)
		if err != nil {
			logger.Warn("jwt public key load failed — auth interceptor disabled", zap.Error(err))
		} else {
			verifier := authsecurity.NewRS256Verifier(pub, cfg.JWTIssuer, cfg.JWTAudience)
			unaryInterceptors = append(unaryInterceptors, grpcauth.UnaryAuthInterceptor(verifier, map[string]struct{}{}))
			streamInterceptors = append(streamInterceptors, grpcauth.StreamAuthInterceptor(verifier, map[string]struct{}{}))
		}
	}

	srv := grpc.NewServer(
		grpc.ChainUnaryInterceptor(unaryInterceptors...),
		grpc.ChainStreamInterceptor(streamInterceptors...),
	)
	notificationsv1.RegisterNotificationServiceServer(
		srv,
		grpcAdapter.New(getNotifications, markRead, markAllRead, rt),
	)
	reflection.Register(srv)

	lis, err := net.Listen("tcp", ":"+cfg.GRPCPort)
	if err != nil {
		_ = rt.Close()
		_ = rmq.Close()
		db.Close()
		return nil, err
	}

	return &App{
		Config:   cfg,
		Logger:   logger,
		db:       db,
		realtime: rt,
		rmq:      rmq,
		server:   srv,
		listener: lis,
		consumer: amqpConsumer,
	}, nil
}

func (a *App) Serve() error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	g, ctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		a.Logger.Info("notify-service gRPC listening", zap.String("port", a.Config.GRPCPort))
		return a.server.Serve(a.listener)
	})

	g.Go(func() error {
		a.Logger.Info("notify-service consumer starting", zap.String("queue", a.Config.BrokerQueue))
		return a.consumer.Run(ctx)
	})

	return g.Wait()
}

func (a *App) GracefulStop() {
	a.server.GracefulStop()
}

func (a *App) Close() {
	if a.realtime != nil {
		_ = a.realtime.Close()
	}
	if a.rmq != nil {
		_ = a.rmq.Close()
	}
	if a.db != nil {
		a.db.Close()
	}
	if a.Logger != nil {
		_ = a.Logger.Sync()
	}
}
