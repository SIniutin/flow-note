package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	pagespb "github.com/flow-note/api-contracts/generated/proto/page/v1"
	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/httpauth"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const permCacheTTL = 5 * time.Minute

// Lua script for atomic page-level invalidation.
// KEYS[1] — pattern  (e.g. "perm:<pageId>:*")
// Uses KEYS (not SCAN) intentionally: single-node Redis only.
// For Redis Cluster this must be replaced with a member-set approach.
var luaInvalidatePage = redis.NewScript(`
local keys = redis.call('KEYS', ARGV[1])
if #keys > 0 then
    redis.call('DEL', unpack(keys))
end
return #keys
`)

// matches /v1/pages/{uuid} and /v1/pages/{uuid}/anything
var pageIDRe = regexp.MustCompile(
	`^/v1/pages/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:/.*)?$`,
)

// matches page-scoped routes whose page id is not under /v1/pages.
var pageScopedPathRe = regexp.MustCompile(
	`^/v1/(?:media/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:/.*)?$|^/v1/media/(?:snapshots/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:/.*)?$`,
)

// matches the target user in /v1/pages/{uuid}/permissions/{user_uuid}
var permTargetRe = regexp.MustCompile(
	`/permissions/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$`,
)

// PagePermCache caches per-(page, user) permission roles in Redis.
// On cache miss it calls page-service's GetMyPagePermission gRPC method.
// Permission-mutating endpoints (grant / revoke / update) automatically
// invalidate the affected cache entry after the request completes.
type PagePermCache struct {
	rdb       *redis.Client
	conn      *grpc.ClientConn // kept so Close() can release it
	pagesGRPC pagespb.PagesServiceClient
	logger    *zap.Logger
}

func NewPagePermCache(
	redisURL string,
	pagesGRPCAddr string,
	dialOpts []grpc.DialOption,
	logger *zap.Logger,
) (*PagePermCache, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("invalid redis URL: %w", err)
	}

	conn, err := grpc.NewClient(pagesGRPCAddr, dialOpts...)
	if err != nil {
		return nil, fmt.Errorf("dial page-service: %w", err)
	}

	return &PagePermCache{
		rdb:       redis.NewClient(opt),
		conn:      conn,
		pagesGRPC: pagespb.NewPagesServiceClient(conn),
		logger:    logger,
	}, nil
}

// Close releases the underlying gRPC connection and Redis client.
// Call this during graceful shutdown.
func (pc *PagePermCache) Close() {
	if err := pc.conn.Close(); err != nil {
		pc.logger.Warn("pageauth: grpc conn close error", zap.Error(err))
	}
	if err := pc.rdb.Close(); err != nil {
		pc.logger.Warn("pageauth: redis client close error", zap.Error(err))
	}
}

// Middleware wraps the next handler with page-permission enforcement.
// Requests whose URL path does not contain a page UUID pass through unchanged.
// For page requests: cache is checked first; on a miss, page-service is queried.
// If the user has no permission (NotFound from gRPC), 403 is returned.
// Transient errors are logged and fail-open (page-service itself still enforces).
func (pc *PagePermCache) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		pageID := extractPageID(r)
		if pageID == "" {
			next.ServeHTTP(w, r)
			return
		}

		authInfo, ok := authctx.AuthInfoFromContext(r.Context())
		if !ok || authInfo.UserID == "" {
			// PolicyAuth hasn't set a userID — downstream will 401
			next.ServeHTTP(w, r)
			return
		}
		userID := authInfo.UserID

		token := httpauth.ExtractAccessToken(r)

		role, err := pc.getPermission(r.Context(), pageID, userID, token)
		if err != nil {
			if st, _ := status.FromError(err); st.Code() == codes.NotFound {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
			pc.logger.Warn("permission cache lookup failed",
				zap.String("pageId", pageID),
				zap.String("userId", userID),
				zap.Error(err),
			)
			// fail-open: let page-service enforce on its own
		}

		ctx := authctx.WithAuthInfo(r.Context(), authctx.AuthInfo{
			UserID: userID,
			Role:   firstNonEmpty(role, authInfo.Role),
		})

		// Invalidate after permission-mutating requests finish
		if isPermMutation(r) {
			targetUser := extractPermTargetUser(r.URL.Path)
			defer pc.invalidate(r.Context(), pageID, targetUser)
		}

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (pc *PagePermCache) getPermission(ctx context.Context, pageID, userID, token string) (string, error) {
	key := fmt.Sprintf("perm:%s:%s", pageID, userID)

	// Cache hit
	if val, err := pc.rdb.Get(ctx, key).Result(); err == nil {
		return val, nil
	} else if err != redis.Nil {
		pc.logger.Warn("redis GET failed", zap.Error(err))
	}

	// Cache miss — query page-service
	md := metadata.Pairs("authorization", "Bearer "+token)
	grpcCtx := metadata.NewOutgoingContext(ctx, md)

	resp, err := pc.pagesGRPC.GetMyPagePermission(grpcCtx, &pagespb.GetMyPagePermissionRequest{
		PageId: pageID,
	})
	if err != nil {
		return "", err
	}

	role := resp.GetPermission().GetRole().String()
	if err := pc.rdb.Set(ctx, key, role, permCacheTTL).Err(); err != nil {
		pc.logger.Warn("redis SET failed", zap.Error(err))
	}
	return role, nil
}

// invalidate removes Redis entries for the given page atomically.
// If targetUserID is non-empty only that user's entry is deleted (single DEL).
// Otherwise a Lua script scans and deletes all perm:{pageId}:* keys atomically.
func (pc *PagePermCache) invalidate(ctx context.Context, pageID, targetUserID string) {
	if targetUserID != "" {
		if err := pc.rdb.Del(ctx, fmt.Sprintf("perm:%s:%s", pageID, targetUserID)).Err(); err != nil {
			pc.logger.Warn("redis DEL failed", zap.String("pageId", pageID), zap.String("userId", targetUserID), zap.Error(err))
		}
		return
	}
	// Atomic page-level invalidation via Lua (single-node Redis).
	pattern := fmt.Sprintf("perm:%s:*", pageID)
	if err := luaInvalidatePage.Run(ctx, pc.rdb, nil, pattern).Err(); err != nil && err != redis.Nil {
		pc.logger.Warn("redis Lua invalidate failed", zap.String("pageId", pageID), zap.Error(err))
	}
}

func extractPageID(r *http.Request) string {
	if pageID := extractPageUUID(r.URL.Path); pageID != "" {
		return pageID
	}
	if pageID := r.URL.Query().Get("page_id"); pageID != "" {
		return pageID
	}
	if r.Body == nil || (r.Method != http.MethodPost && r.Method != http.MethodPatch && r.Method != http.MethodPut) {
		return ""
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		return ""
	}
	r.Body = io.NopCloser(bytes.NewReader(body))

	var payload struct {
		PageID string `json:"page_id"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return ""
	}
	return payload.PageID
}

func extractPageUUID(path string) string {
	for _, re := range []*regexp.Regexp{pageIDRe, pageScopedPathRe} {
		m := re.FindStringSubmatch(path)
		for i := 1; i < len(m); i++ {
			if m[i] != "" {
				return m[i]
			}
		}
	}
	return ""
}

func extractPermTargetUser(path string) string {
	m := permTargetRe.FindStringSubmatch(path)
	if len(m) < 2 {
		return ""
	}
	return m[1]
}

func isPermMutation(r *http.Request) bool {
	return strings.Contains(r.URL.Path, "/permissions") &&
		(r.Method == http.MethodPost || r.Method == http.MethodDelete || r.Method == http.MethodPatch)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
