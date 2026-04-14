package app

import (
	"context"
	"net"
	"time"

	authpb "github.com/flow-note/api-contracts/generated/proto/auth/v1"
	"github.com/flow-note/auth-service/db"
	"github.com/flow-note/auth-service/internal/store/postgre"
	redrepo "github.com/flow-note/auth-service/internal/store/redis"
	handlergrpc "github.com/flow-note/auth-service/internal/transport/grpc"
	"github.com/flow-note/auth-service/internal/usecase"
	sec "github.com/flow-note/common/authsecurity"
	commonpg "github.com/flow-note/common/postgres"
	commonruntime "github.com/flow-note/common/runtime"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

type App struct {
	cfg Config
}

func New(cfg Config) *App {
	return &App{cfg: cfg}
}

func (a *App) Run(ctx context.Context) error {
	logger, _, err := commonruntime.NewLogger()
	if err != nil {
		return err
	}
	defer func() { _ = logger.Sync() }()

	dbPool, err := commonpg.New(ctx, a.cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer dbPool.Close()

	db.SetupPostgres(dbPool.Pool, logger)
	userRepo := postgre.NewPostgreRepo(dbPool)

	rdb := redis.NewClient(&redis.Options{
		Addr:     a.cfg.RedisAddr,
		Password: a.cfg.RedisPassword,
		DB:       0,
	})
	defer func() { _ = rdb.Close() }()

	sessionRepo := redrepo.NewRedisRepo(rdb)

	privateKey, err := sec.LoadRSAPrivateKeyFromPEMFile(a.cfg.PrivateKeyPath)
	if err != nil {
		return err
	}

	issuer := sec.NewRS256Issuer(privateKey, a.cfg.JWTIssuer, a.cfg.JWTAudience, a.cfg.JWTAccessTTL, a.cfg.JWTKeyID)

	regUser := usecase.NewRegisterUser(sessionRepo, userRepo, issuer)
	logUser := usecase.NewLoginUser(sessionRepo, userRepo, issuer)
	refreshUC := usecase.NewRefreshUser(sessionRepo, issuer)
	logoutUC := usecase.NewLogoutUser(sessionRepo)
	getByIDUC := usecase.NewGetUserById(userRepo)
	getByNameUC := usecase.NewGetUserByName(userRepo)

	handler := handlergrpc.NewServer(regUser, logUser, refreshUC, logoutUC, getByIDUC, getByNameUC)

	srv := grpc.NewServer(grpc.UnaryInterceptor(recoveryUnaryServerInterceptor(logger)))
	authpb.RegisterAuthServiceServer(srv, handler)
	if a.cfg.EnableReflection {
		reflection.Register(srv)
	}

	lis, err := net.Listen("tcp", a.cfg.GRPCAddr)
	if err != nil {
		return err
	}

	logger.Info("auth-service gRPC listening", zap.String("addr", a.cfg.GRPCAddr))
	logger.Info("auth-service jwt config:",
		zap.String("private_key_path", a.cfg.PrivateKeyPath),
		zap.String("issuer", a.cfg.JWTIssuer),
		zap.String("audience", a.cfg.JWTAudience),
		zap.String("key_id", a.cfg.JWTKeyID),
		zap.Duration("access_ttl", a.cfg.JWTAccessTTL),
	)

	errCh := make(chan error, 1)
	go func() {
		errCh <- srv.Serve(lis)
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		done := make(chan struct{})
		go func() {
			srv.GracefulStop()
			close(done)
		}()

		select {
		case <-done:
		case <-shutdownCtx.Done():
			return shutdownCtx.Err()
		}

		if err := <-errCh; err != nil {
			return err
		}
		return nil
	}
}
