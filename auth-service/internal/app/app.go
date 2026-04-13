package app

import (
	"context"

	"github.com/redis/go-redis/v9"
	authpb "github.com/tasker-iniutin/auth-service/proto/auth/v1"
	sec "github.com/tasker-iniutin/common/authsecurity"
	"github.com/tasker-iniutin/common/postgres"
	"github.com/tasker-iniutin/common/runtime"
	"go.uber.org/zap"
	"google.golang.org/grpc"

	"github.com/tasker-iniutin/auth-service/internal/store/postgre"
	redrepo "github.com/tasker-iniutin/auth-service/internal/store/redis"
	handlergrpc "github.com/tasker-iniutin/auth-service/internal/transport/grpc"
	"github.com/tasker-iniutin/auth-service/internal/usecase"
)

type App struct {
	cfg Config
}

func New(cfg Config) *App {
	return &App{cfg: cfg}
}

func (a *App) Run(ctx context.Context) error {
	logger, cleanup, err := runtime.NewLogger()
	if err != nil {
		return err
	}
	defer cleanup()

	db, err := postgres.Open(context.Background(), a.cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer db.Close()

	userRepo := postgre.NewPostgreRepo(db)

	rdb := redis.NewClient(&redis.Options{
		Addr:     a.cfg.RedisAddr,
		Password: a.cfg.RedisPassword,
		DB:       0,
	})

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

	handler := handlergrpc.NewServer(regUser, logUser, refreshUC, logoutUC)

	logger.Info("auth-service gRPC listening on ", zap.String("addr", a.cfg.GRPCAddr))
	logger.Info(
		"auth-service jwt config:",
		zap.String("private_key_path", a.cfg.PrivateKeyPath),
		zap.String("issuer", a.cfg.JWTIssuer),
		zap.String("audience", a.cfg.JWTAudience),
		zap.String("key_id", a.cfg.JWTKeyID),
		zap.Duration("access_ttl", a.cfg.JWTAccessTTL),
	)

	return runtime.ServeGRPCWithContext(
		ctx,
		a.cfg.GRPCAddr,
		func(server *grpc.Server) {
			authpb.RegisterAuthServiceServer(server, handler)
		},
		a.cfg.EnableReflection,
		grpc.UnaryInterceptor(runtime.RecoveryUnaryServerInterceptor(logger)),
	)
}
