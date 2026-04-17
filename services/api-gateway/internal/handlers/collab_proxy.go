package handlers

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"go.uber.org/zap"
)

// NewCollabProxy returns a reverse proxy that forwards /collab/* WebSocket
// connections to the collab-service. The full path is preserved so that
// hocuspocus can extract the document name from it.
//
// JWT validation for collab connections is done inside collab-service itself
// (onAuthenticate hook), so this proxy does not require an Authorization header.
// FlushInterval=-1 enables instant flushing required for WebSocket streaming.
func NewCollabProxy(target string, logger *zap.Logger) http.Handler {
	backend := &url.URL{
		Scheme: "http",
		Host:   target,
	}
	proxy := httputil.NewSingleHostReverseProxy(backend)
	proxy.FlushInterval = -1
	originalDirector := proxy.Director
	proxy.Director = func(r *http.Request) {
		originalDirector(r)
		logger.Info(
			"collab proxy upstream request",
			zap.String("method", r.Method),
			zap.String("path", r.URL.Path),
			zap.String("query", r.URL.RawQuery),
			zap.String("target", backend.String()),
			zap.String("upgrade", r.Header.Get("Upgrade")),
		)
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		logger.Error(
			"collab proxy error",
			zap.String("method", r.Method),
			zap.String("path", r.URL.Path),
			zap.String("query", r.URL.RawQuery),
			zap.String("target", backend.String()),
			zap.String("upgrade", r.Header.Get("Upgrade")),
			zap.Bool("is_websocket", strings.EqualFold(r.Header.Get("Upgrade"), "websocket")),
			zap.Error(err),
		)
		http.Error(w, "collab upstream unavailable", http.StatusBadGateway)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger.Info(
			"collab proxy request",
			zap.String("method", r.Method),
			zap.String("path", r.URL.Path),
			zap.String("query", r.URL.RawQuery),
			zap.String("remote_addr", r.RemoteAddr),
			zap.String("origin", r.Header.Get("Origin")),
			zap.String("upgrade", r.Header.Get("Upgrade")),
			zap.Bool("is_websocket", strings.EqualFold(r.Header.Get("Upgrade"), "websocket")),
		)
		proxy.ServeHTTP(w, r)
	})
}
