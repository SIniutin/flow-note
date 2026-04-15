package app

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"

	mediav1 "github.com/flow-note/api-contracts/generated/proto/media/v1"
	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/authsecurity"
	"github.com/flow-note/common/grpcauth"
	"github.com/flow-note/media-service/config"
	"github.com/flow-note/media-service/internal/handler"
	"github.com/flow-note/media-service/internal/repository"
	"github.com/flow-note/media-service/internal/usecase"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/reflection"
)

type App struct {
	logger     *zap.Logger
	cfg        config.Config
	grpcServer *grpc.Server
	httpServer *http.Server
}

func New(cfg config.Config, logger *zap.Logger) (*App, error) {
	if logger == nil {
		return nil, fmt.Errorf("logger is required")
	}

	if cfg.Server.GRPCPort == "" {
		return nil, fmt.Errorf("grpc port is required")
	}

	if cfg.Server.HTTPPort == "" {
		return nil, fmt.Errorf("http port is required")
	}

	if cfg.MinIO.Host == "" {
		return nil, fmt.Errorf("minio host is required")
	}

	if cfg.MinIO.Port == "" {
		return nil, fmt.Errorf("minio port is required")
	}

	if cfg.MinIO.BucketName == "" {
		return nil, fmt.Errorf("minio bucket name is required")
	}

	if cfg.MinIO.URLTTL <= 0 {
		return nil, fmt.Errorf("minio url ttl must be positive")
	}

	if cfg.Server.ShutdownTimeout <= 0 {
		cfg.Server.ShutdownTimeout = 10 * time.Second
	}

	return &App{
		logger: logger,
		cfg:    cfg,
	}, nil
}

func (a *App) Run(ctx context.Context) error {
	grpcAddr := ":" + a.cfg.Server.GRPCPort
	httpAddr := ":" + a.cfg.Server.HTTPPort
	minioEndpoint := a.cfg.MinIO.Host + ":" + a.cfg.MinIO.Port

	grpcListener, err := net.Listen("tcp", grpcAddr)
	if err != nil {
		return fmt.Errorf("listen grpc: %w", err)
	}

	minioClient, err := minio.New(minioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(a.cfg.MinIO.AccessKey, a.cfg.MinIO.SecretKey, ""),
		Secure: a.cfg.MinIO.UseSSL,
	})
	if err != nil {
		_ = grpcListener.Close()
		return fmt.Errorf("create minio client: %w", err)
	}

	minioRepo := repository.NewMinioRepository(
		minioClient,
		a.cfg.MinIO.BucketName,
		a.cfg.MinIO.URLTTL,
		a.cfg.MinIO.URLTTL,
	)

	uc := usecase.NewMediaService(a.logger, minioRepo, minioRepo)
	h := handler.NewMediaHandler(a.logger, uc, uc)

	key, err := authsecurity.LoadRSAPublicKeyFromPEMFile(a.cfg.JWT.PublicKeyPath)
	if err != nil {
		a.logger.Fatal("failed to parse RSA public key", zap.String("key", a.cfg.JWT.PublicKeyPath), zap.Error(err))
	}

	verifier := authsecurity.NewRS256Verifier(key, a.cfg.JWT.Issuer, a.cfg.JWT.Audience)

	a.grpcServer = grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			grpcauth.UnaryAuthInterceptor(verifier, map[string]struct{}{
				// TODO: make from config
			}),
			roleFromGatewayInterceptor(),
		),
	)

	mediav1.RegisterMediaServiceServer(a.grpcServer, h)
	reflection.Register(a.grpcServer)

	gatewayMux := runtime.NewServeMux()
	gatewayCtx, gatewayCancel := context.WithCancel(ctx)
	defer gatewayCancel()

	if err = mediav1.RegisterMediaServiceHandlerFromEndpoint(
		gatewayCtx,
		gatewayMux,
		grpcAddr,
		[]grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())},
	); err != nil {
		_ = grpcListener.Close()
		return fmt.Errorf("register grpc gateway handler: %w", err)
	}

	a.httpServer = &http.Server{
		Addr:              httpAddr,
		Handler:           a.httpHandler(gatewayMux),
		ReadHeaderTimeout: a.cfg.Server.ReadTimeout,
		WriteTimeout:      a.cfg.Server.WriteTimeout,
		IdleTimeout:       a.cfg.Server.IdleTimeout,
	}

	a.logger.Info("application initialized",
		zap.String("grpc_addr", grpcAddr),
		zap.String("http_addr", httpAddr),
		zap.String("minio_endpoint", minioEndpoint),
		zap.String("bucket_name", a.cfg.MinIO.BucketName),
	)

	group, groupCtx := errgroup.WithContext(ctx)

	group.Go(func() error {
		a.logger.Info("grpc server started", zap.String("addr", grpcAddr))

		if serveErr := a.grpcServer.Serve(grpcListener); serveErr != nil {
			return fmt.Errorf("serve grpc: %w", serveErr)
		}

		return nil
	})

	group.Go(func() error {
		a.logger.Info("http server started", zap.String("addr", httpAddr))

		if serveErr := a.httpServer.ListenAndServe(); serveErr != nil && serveErr != http.ErrServerClosed {
			return fmt.Errorf("serve http: %w", serveErr)
		}

		return nil
	})

	group.Go(func() error {
		<-groupCtx.Done()

		shutdownCtx, cancel := context.WithTimeout(context.Background(), a.cfg.Server.ShutdownTimeout)
		defer cancel()

		a.logger.Info("shutting down application")

		if a.httpServer != nil {
			if err := a.httpServer.Shutdown(shutdownCtx); err != nil {
				a.logger.Warn("http server shutdown failed", zap.Error(err))
			}
		}

		shutdownCh := make(chan struct{})
		go func() {
			defer close(shutdownCh)
			if a.grpcServer != nil {
				a.grpcServer.GracefulStop()
			}
		}()

		select {
		case <-shutdownCh:
		case <-shutdownCtx.Done():
			if a.grpcServer != nil {
				a.grpcServer.Stop()
			}
		}

		return nil
	})

	if err = group.Wait(); err != nil {
		a.logger.Error("application stopped with error", zap.Error(err))
		return err
	}

	a.logger.Info("application stopped")

	return nil
}

func (a *App) httpHandler(gatewayMux *runtime.ServeMux) http.Handler {
	mux := http.NewServeMux()

	mux.Handle("/", gatewayMux)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ww := &statusWriter{ResponseWriter: w, statusCode: http.StatusOK}
		mux.ServeHTTP(ww, r)
	})
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

func (a *App) unaryLoggingInterceptor(
	ctx context.Context,
	req any,
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (any, error) {
	startedAt := time.Now()

	a.logger.Info("grpc unary request received",
		zap.String("method", info.FullMethod),
	)

	resp, err := handler(ctx, req)

	a.logger.Info("grpc unary request handled",
		zap.String("method", info.FullMethod),
		zap.Duration("duration", time.Since(startedAt)),
	)

	return resp, err
}

func (a *App) streamLoggingInterceptor(
	srv any,
	ss grpc.ServerStream,
	info *grpc.StreamServerInfo,
	handler grpc.StreamHandler,
) error {
	startedAt := time.Now()

	a.logger.Info("grpc stream request received",
		zap.String("method", info.FullMethod),
	)

	err := handler(srv, ss)

	a.logger.Info("grpc stream request handled",
		zap.String("method", info.FullMethod),
		zap.Duration("duration", time.Since(startedAt)),
	)

	return err
}

type statusWriter struct {
	http.ResponseWriter
	statusCode int
}

func (w *statusWriter) WriteHeader(statusCode int) {
	w.statusCode = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}
