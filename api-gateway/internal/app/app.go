package app

import (
	"context"
	"net/http"
	"strings"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	authpb "github.com/tasker-iniutin/api-gateway/proto/auth/v1"
	notifypb "github.com/tasker-iniutin/api-gateway/proto/notify/v1"
	taskpb "github.com/tasker-iniutin/api-gateway/proto/task/v1"
	"github.com/tasker-iniutin/api-gateway/internal/handlers"
	"github.com/tasker-iniutin/api-gateway/internal/middleware"
	sec "github.com/tasker-iniutin/common/authsecurity"
	"github.com/tasker-iniutin/common/httpauth"
	cr "github.com/tasker-iniutin/common/runtime"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

type App struct {
	cfg Config
}

func New(cfg Config) *App {
	return &App{cfg: cfg}
}

func (a *App) Run(ctx context.Context) error {
	logger, cleanup, err := cr.NewLogger()
	if err != nil {
		return err
	}
	defer cleanup()

	pub, err := sec.LoadRSAPublicKeyFromPEMFile(a.cfg.PublicKeyPath)
	if err != nil {
		logger.Error("failed to load public key", zap.String("path", a.cfg.PublicKeyPath), zap.Error(err))
		return err
	}
	verifier := sec.NewRS256Verifier(pub, a.cfg.JWTIssuer, a.cfg.JWTAudience)

	grpcgw := runtime.NewServeMux(
		runtime.WithMetadata(func(ctx context.Context, r *http.Request) metadata.MD {
			if token := httpauth.TokenFromRequest(r); token != "" {
				return metadata.Pairs("authorization", "Bearer "+token)
			}
			return nil
		}),
	)

	dialOpts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()), // BAD
	}

	if err := taskpb.RegisterTaskServiceHandlerFromEndpoint(ctx, grpcgw, a.cfg.TaskGRPCAddr, dialOpts); err != nil {
		logger.Error("failed to setup task service handler", zap.Error(err))
		return err
	}
	if err := authpb.RegisterAuthServiceHandlerFromEndpoint(ctx, grpcgw, a.cfg.AuthGRPCAddr, dialOpts); err != nil {
		logger.Error("failed to setup auth service handler", zap.Error(err))
		return err
	}
	if err := notifypb.RegisterNotifyServiceHandlerFromEndpoint(ctx, grpcgw, a.cfg.NotifyGRPCAddr, dialOpts); err != nil {
		logger.Error("failed to setup notify service handler", zap.Error(err))
		return err
	}

	notifyConn, err := grpc.NewClient(
		a.cfg.NotifyGRPCAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		logger.Error("failed to dial notify service", zap.Error(err))
		return err
	}
	defer notifyConn.Close()

	notifyClient := notifypb.NewNotifyServiceClient(notifyConn)
	notificationHandler := handlers.NewNotificationHandler(notifyClient)

	// ── Protected mux (requires valid JWT) ───────────────────────────────────
	mux := http.NewServeMux()
	mux.Handle("/healthz", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	mux.Handle("/v1/notifications/stream", http.HandlerFunc(notificationHandler.Stream))
	mux.Handle("/", grpcgw)

	whitelist := map[string]struct{}{
		"/healthz":          {},
		"/v1/auth/login":    {},
		"/v1/auth/register": {},
		"/v1/auth/refresh":  {},
	}
	authMux := httpauth.AuthJWT(mux, verifier, whitelist)

	// ── Collab proxy (/collab/*) — JWT validation is done inside collab-service
	// via onAuthenticate; the proxy is intentionally unauthenticated at this layer.
	collabProxy := handlers.NewCollabProxy(a.cfg.CollabAddr)

	// ── Root dispatcher: collab bypasses JWT middleware, everything else goes through it
	root := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/collab/") {
			collabProxy.ServeHTTP(w, r)
			return
		}
		authMux.ServeHTTP(w, r)
	})

	var handler http.Handler = root
	handler = middleware.Cors(a.cfg.AllowedOrigin)(handler)
	handler = cr.RecoveryMiddleware(logger)(handler)

	logger.Info(
		"api-gateway listening",
		zap.String("http_addr", a.cfg.HTTPAddr),
		zap.String("task_addr", a.cfg.TaskGRPCAddr),
		zap.String("auth_addr", a.cfg.AuthGRPCAddr),
		zap.String("notify_addr", a.cfg.NotifyGRPCAddr),
		zap.String("collab_addr", a.cfg.CollabAddr),
	)

	return cr.ServeHTTP(ctx, a.cfg.HTTPAddr, handler)
}
