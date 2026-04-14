package app

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"pages-service/common/authsecurity"
	"pages-service/config"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"pages-service/common/grpcauth"
	pb "pages-service/generated/proto/pages/v1"
	"pages-service/internal/handler"
	"pages-service/internal/repository"
	"pages-service/internal/usecase"

	"pages-service/db"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
)

type App struct {
	grpcServer *grpc.Server
	httpServer *http.Server
	listener   net.Listener
	dbPool     *pgxpool.Pool
}

func New(ctx context.Context, logger *zap.Logger, cfg config.Config) (*App, error) {
	dbPool, err := pgxpool.New(ctx, cfg.DB.URL())
	if err != nil {
		return nil, err
	}

	db.SetupPostgres(dbPool, logger)

	key, err := authsecurity.ParseRSAPublicKeyPEM(cfg.JWT.PublicKey)
	if err != nil {
		logger.Fatal("failed to parse RSA public key", zap.String("key", string(cfg.JWT.PublicKey)), zap.Error(err))
	}

	verifier := authsecurity.NewRS256Verifier(key, cfg.JWT.Issuer, cfg.JWT.Audience)

	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(grpcauth.UnaryAuthInterceptor(verifier, map[string]struct{}{
			// TODO: make from config
		})),
	)

	repo := repository.NewRepository(dbPool)
	uc := usecase.NewService(logger, repo, repo, repo, repo, repo, repo, repo)

	h := handler.NewPagesHandler(logger, uc, uc, uc, uc, uc, uc, uc)
	pb.RegisterPagesServiceServer(grpcServer, h)

	lis, err := net.Listen("tcp", fmt.Sprintf(":%s", cfg.GRPC.Port))
	if err != nil {
		dbPool.Close()
		return nil, err
	}

	mux := runtime.NewServeMux(
		runtime.WithIncomingHeaderMatcher(func(key string) (string, bool) {
			if strings.EqualFold(key, "Authorization") {
				return "authorization", true
			}
			return runtime.DefaultHeaderMatcher(key)
		}),
	)

	dialOpts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}

	err = pb.RegisterPagesServiceHandlerFromEndpoint(
		ctx,
		mux,
		fmt.Sprintf("localhost:%s", cfg.GRPC.Port),
		dialOpts,
	)
	if err != nil {
		_ = lis.Close()
		dbPool.Close()
		return nil, err
	}

	httpServer := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.HTTP.Port),
		Handler: mux,
	}

	return &App{
		grpcServer: grpcServer,
		httpServer: httpServer,
		listener:   lis,
		dbPool:     dbPool,
	}, nil
}

func (a *App) Run() error {
	grpcErrCh := make(chan error, 1)

	go func() {
		grpcErrCh <- a.grpcServer.Serve(a.listener)
	}()

	httpErr := a.httpServer.ListenAndServe()
	if httpErr != nil && httpErr != http.ErrServerClosed {
		return httpErr
	}

	select {
	case grpcErr := <-grpcErrCh:
		if grpcErr != nil && grpcErr != grpc.ErrServerStopped {
			return grpcErr
		}
	default:
	}

	return nil
}

func (a *App) Shutdown(ctx context.Context) error {
	a.grpcServer.GracefulStop()

	if err := a.httpServer.Shutdown(ctx); err != nil {
		return err
	}

	if a.listener != nil {
		_ = a.listener.Close()
	}
	if a.dbPool != nil {
		a.dbPool.Close()
	}

	return nil
}
