package runtime

import (
	"net/http"

	"go.uber.org/zap"
)

// RecoveryMiddleware recovers from panics in HTTP handlers and logs the stack.
func RecoveryMiddleware(logger *zap.Logger) func(http.Handler) http.Handler {
	if logger == nil {
		logger = zap.NewNop()
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					logger.Error(
						"http panic",
						zap.Any("recover", rec),
						zap.String("method", r.Method),
						zap.String("path", r.URL.Path),
						zap.Stack("stack"),
					)
					http.Error(w, "internal error", http.StatusInternalServerError)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}
