package app

import (
	"context"
	"net/http"
	"strings"

	authpb "github.com/flow-note/api-contracts/generated/proto/auth/v1"
	collabpb "github.com/flow-note/api-contracts/generated/proto/collab/v1"
	commentpb "github.com/flow-note/api-contracts/generated/proto/comment/v1"
	mediapb "github.com/flow-note/api-contracts/generated/proto/media/v1"
	notifypb "github.com/flow-note/api-contracts/generated/proto/notify/v1"
	pagespb "github.com/flow-note/api-contracts/generated/proto/page/v1"
	"github.com/flow-note/api-gateway/internal/handlers"
	"github.com/flow-note/api-gateway/internal/middleware"
	p "github.com/flow-note/api-gateway/internal/policy"
	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/authsecurity"
	"github.com/flow-note/common/httpauth"
	cr "github.com/flow-note/common/runtime"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

// policies defines auth requirements per method+path.
// {param} wildcards match a single path segment.
// Unmatched routes default to AuthOnly.
var policies = map[string]p.Policy{
	"GET /healthz":           {Mode: p.Public},
	"POST /v1/auth/login":    {Mode: p.Public},
	"POST /v1/auth/register": {Mode: p.Public},
	"POST /v1/auth/refresh":  {Mode: p.Public},
}

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

	pub, err := authsecurity.LoadRSAPublicKeyFromPEMFile(a.cfg.PublicKeyPath)
	if err != nil {
		logger.Error("failed to load public key", zap.String("path", a.cfg.PublicKeyPath), zap.Error(err))
		return err
	}
	verifier := authsecurity.NewRS256Verifier(pub, a.cfg.JWTIssuer, a.cfg.JWTAudience)

	grpcgw := runtime.NewServeMux(
		runtime.WithMetadata(func(ctx context.Context, r *http.Request) metadata.MD {
			md := metadata.MD{}

			if token := httpauth.ExtractAccessToken(r); token != "" {
				md.Set("authorization", "Bearer "+token)
			}
			if authInfo, ok := authctx.AuthInfoFromContext(ctx); ok && authInfo.Role != "" {
				md.Set("x-user-role", authInfo.Role)
			}

			if len(md) == 0 {
				return nil
			}
			return md
		}),
	)

	dialOpts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	}

	notifyConn, err := grpc.NewClient(a.cfg.NotifyGRPCAddr, dialOpts...)
	if err != nil {
		logger.Error("failed to connect notify service", zap.Error(err))
		return err
	}
	defer notifyConn.Close()
	notifyClient := notifypb.NewNotificationServiceClient(notifyConn)

	if err := authpb.RegisterAuthServiceHandlerFromEndpoint(ctx, grpcgw, a.cfg.AuthGRPCAddr, dialOpts); err != nil {
		logger.Error("failed to register auth service", zap.Error(err))
		return err
	}
	if err := collabpb.RegisterCollabTableServiceHandlerFromEndpoint(ctx, grpcgw, a.cfg.CollabGRPCAddr, dialOpts); err != nil {
		logger.Error("failed to register collab table service", zap.Error(err))
		return err
	}
	if err := commentpb.RegisterCommentServiceHandlerFromEndpoint(ctx, grpcgw, a.cfg.CommentGRPCAddr, dialOpts); err != nil {
		logger.Error("failed to register comment service", zap.Error(err))
		return err
	}
	if err := mediapb.RegisterMediaServiceHandlerFromEndpoint(ctx, grpcgw, a.cfg.MediaGRPCAddr, dialOpts); err != nil {
		logger.Error("failed to register media service", zap.Error(err))
		return err
	}
	if err := pagespb.RegisterPagesServiceHandlerFromEndpoint(ctx, grpcgw, a.cfg.PagesGRPCAddr, dialOpts); err != nil {
		logger.Error("failed to register pages service", zap.Error(err))
		return err
	}
	if err := notifypb.RegisterNotificationServiceHandlerFromEndpoint(ctx, grpcgw, a.cfg.NotifyGRPCAddr, dialOpts); err != nil {
		logger.Error("failed to register notify service", zap.Error(err))
		return err
	}

	// ── Permission cache (Redis + page-service gRPC) ─────────────────────────
	permCache, err := middleware.NewPagePermCache(a.cfg.RedisURL, a.cfg.PagesGRPCAddr, dialOpts, logger)
	if err != nil {
		logger.Error("failed to create permission cache", zap.Error(err))
		return err
	}
	defer permCache.Close()

	// ── Request mux ──────────────────────────────────────────────────────────
	mux := http.NewServeMux()
	mux.Handle("/healthz", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	mux.Handle("/v1/notifications/stream", handlers.NewNotifySSE(notifyClient, logger))
	mux.Handle("/", grpcgw)

	// Chain: PolicyAuth → permCache → grpcgw
	// PolicyAuth validates JWT and puts userID in ctx.
	// permCache checks page-level permissions using Redis / page-service.
	protectedMux := middleware.PolicyAuth(permCache.Middleware(mux), verifier, policies)

	// ── Collab proxy (/collab/*) — JWT validation is done inside collab-service
	collabProxy := handlers.NewCollabProxy(a.cfg.CollabAddr, logger)

	root := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/collab" || strings.HasPrefix(r.URL.Path, "/collab/") {
			collabProxy.ServeHTTP(w, r)
			return
		}
		protectedMux.ServeHTTP(w, r)
	})

	var handler http.Handler = root
	handler = middleware.RateLimit(5, 10)(handler)
	handler = middleware.Cors(a.cfg.AllowedOrigin)(handler)
	handler = middleware.RequestLog(logger)(handler)
	handler = cr.RecoveryMiddleware(logger)(handler)

	logger.Info("api-gateway listening",
		zap.String("http_addr", a.cfg.HTTPAddr),
		zap.String("auth_grpc", a.cfg.AuthGRPCAddr),
		zap.String("pages_grpc", a.cfg.PagesGRPCAddr),
		zap.String("comment_grpc", a.cfg.CommentGRPCAddr),
		zap.String("media_grpc", a.cfg.MediaGRPCAddr),
		zap.String("notify_grpc", a.cfg.NotifyGRPCAddr),
		zap.String("collab_grpc", a.cfg.CollabGRPCAddr),
		zap.String("collab_ws", a.cfg.CollabAddr),
		zap.String("allowed_origin", a.cfg.AllowedOrigin),
		zap.String("redis", a.cfg.RedisURL),
	)

	return cr.ServeHTTP(ctx, a.cfg.HTTPAddr, handler)
}
