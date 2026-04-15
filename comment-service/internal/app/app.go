package app

import (
	"context"
	"net"

	commentv1 "github.com/flow-note/api-contracts/generated/proto/comment/v1"
	"github.com/flow-note/comment-service/db"
	"github.com/flow-note/comment-service/internal/config"
	grpcHandler "github.com/flow-note/comment-service/internal/handler/grpc"
	"github.com/flow-note/comment-service/internal/repository"
	commentservice "github.com/flow-note/comment-service/internal/service"
	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/authsecurity"
	"github.com/flow-note/common/broker"
	"github.com/flow-note/common/grpcauth"
	commonpg "github.com/flow-note/common/postgres"
	commonruntime "github.com/flow-note/common/runtime"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/reflection"
)

type App struct {
	Config   config.Config
	Logger   *zap.Logger
	db       *commonpg.DB
	rmq      *broker.RabbitMQ
	server   *grpc.Server
	listener net.Listener
}

func New(cfg config.Config) (*App, error) {
	logger, _, err := commonruntime.NewLogger()
	if err != nil {
		return nil, err
	}
	dbPool, err := commonpg.New(context.Background(), cfg.PostgresDSN)
	if err != nil {
		return nil, err
	}
	lis, err := net.Listen("tcp", ":"+cfg.GRPCPort)
	if err != nil {
		dbPool.Close()
		return nil, err
	}
	db.SetupPostgres(dbPool.Pool, logger)

	commentsRepo := repository.NewPostgres(dbPool)
	rmq, err := broker.NewRabbitMQ(cfg.BrokerURL, cfg.BrokerExchange)
	if err != nil {
		dbPool.Close()
		_ = lis.Close()
		return nil, err
	}

	commentsService := commentservice.New(dbPool, commentsRepo, commentsRepo, rmq)
	key, err := authsecurity.LoadRSAPublicKeyFromPEMFile(cfg.JWTPublicKeyPEM)
	if err != nil {
		_ = rmq.Close()
		dbPool.Close()
		_ = lis.Close()
		return nil, err
	}
	verifier := authsecurity.NewRS256Verifier(key, cfg.JWTIssuer, cfg.JWTAudience)

	srv := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			commonruntime.RecoveryUnaryServerInterceptor(logger),
			grpcauth.UnaryAuthInterceptor(verifier, map[string]struct{}{}),
			roleFromGatewayInterceptor(),
		),
	)
	commentv1.RegisterCommentServiceServer(srv, grpcHandler.New(commentsService, logger))
	reflection.Register(srv)
	return &App{
		Config:   cfg,
		Logger:   logger,
		db:       dbPool,
		rmq:      rmq,
		server:   srv,
		listener: lis,
	}, nil
}

// roleFromGatewayInterceptor reads the x-user-role gRPC metadata header that
// api-gateway sets (from its per-page Redis permission cache) and patches the
// authctx so that ParseUserIDAndPermissionRole succeeds without a JWT role claim.
func roleFromGatewayInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return handler(ctx, req)
		}
		vals := md.Get("x-user-role")
		if len(vals) == 0 || vals[0] == "" {
			return handler(ctx, req)
		}
		if info, ok := authctx.AuthInfoFromContext(ctx); ok {
			ctx = authctx.WithAuthInfo(ctx, authctx.AuthInfo{UserID: info.UserID, Role: vals[0]})
		}
		return handler(ctx, req)
	}
}

func (a *App) Serve() error {
	return a.server.Serve(a.listener)
}

func (a *App) GracefulStop() {
	a.server.GracefulStop()
}

func (a *App) Close() {
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
