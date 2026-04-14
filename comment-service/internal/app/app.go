package app

import (
	"net"

	commentv1 "github.com/flow-note/api-contracts/generated/comment/v1"
	"github.com/flow-note/comment-service/internal/config"
	grpcHandler "github.com/flow-note/comment-service/internal/handler/grpc"
	commonruntime "github.com/flow-note/common/runtime"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

type App struct {
	Config   config.Config
	Logger   *zap.Logger
	server   *grpc.Server
	listener net.Listener
}

func New(cfg config.Config) (*App, error) {
	logger, _, err := commonruntime.NewLogger()
	if err != nil {
		return nil, err
	}
	lis, err := net.Listen("tcp", ":"+cfg.GRPCPort)
	if err != nil {
		return nil, err
	}
	srv := grpc.NewServer()
	commentv1.RegisterCommentServiceServer(srv, grpcHandler.New())
	reflection.Register(srv)
	return &App{
		Config:   cfg,
		Logger:   logger,
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
	if a.Logger != nil {
		_ = a.Logger.Sync()
	}
}
