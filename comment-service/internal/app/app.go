package app

import (
	"context"
	"net"

	commentv1 "github.com/flow-note/api-contracts/generated/proto/comment/v1"
	"github.com/flow-note/comment-service/internal/config"
	grpcHandler "github.com/flow-note/comment-service/internal/handler/grpc"
	"github.com/flow-note/comment-service/internal/repository"
	commentservice "github.com/flow-note/comment-service/internal/service"
	commonpg "github.com/flow-note/common/postgres"
	commonruntime "github.com/flow-note/common/runtime"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

type App struct {
	Config   config.Config
	Logger   *zap.Logger
	db       *commonpg.DB
	server   *grpc.Server
	listener net.Listener
}

func New(cfg config.Config) (*App, error) {
	logger, _, err := commonruntime.NewLogger()
	if err != nil {
		return nil, err
	}
	db, err := commonpg.New(context.Background(), cfg.PostgresDSN)
	if err != nil {
		return nil, err
	}
	lis, err := net.Listen("tcp", ":"+cfg.GRPCPort)
	if err != nil {
		db.Close()
		return nil, err
	}

	commentsRepo := repository.NewPostgres(db)
	commentsService := commentservice.New(db, commentsRepo, commentsRepo)
	srv := grpc.NewServer()
	commentv1.RegisterCommentServiceServer(srv, grpcHandler.New(commentsService))
	reflection.Register(srv)
	return &App{
		Config:   cfg,
		Logger:   logger,
		db:       db,
		server:   srv,
		listener: lis,
	}, nil
}

func (a *App) Serve() error {
	return a.server.Serve(a.listener)
}

func (a *App) GracefulStop() {
	a.server.GracefulStop()
}

func (a *App) Close() {
	if a.db != nil {
		a.db.Close()
	}
	if a.Logger != nil {
		_ = a.Logger.Sync()
	}
}
