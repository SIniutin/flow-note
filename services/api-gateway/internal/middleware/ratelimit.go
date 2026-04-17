package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// rateLimitedPaths are auth endpoints susceptible to brute-force attacks.
// All other paths are not rate-limited by this middleware.
var rateLimitedPaths = map[string]struct{}{
	"/v1/auth/login":    {},
	"/v1/auth/register": {},
	"/v1/auth/refresh":  {},
}

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// RateLimiter holds per-IP token bucket limiters for auth endpoints.
// Defaults: 5 requests/second burst of 10 — enough for a user logging in,
// tight enough to block automated attacks.
type RateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	r        rate.Limit // tokens per second
	b        int        // burst size

	cleanupEvery time.Duration
	cleanupAfter time.Duration
}

// NewRateLimiter creates a limiter that allows r req/s with burst b per IP.
// Background cleanup removes inactive IPs every cleanupEvery duration.
func NewRateLimiter(r rate.Limit, b int) *RateLimiter {
	rl := &RateLimiter{
		visitors:     make(map[string]*visitor),
		r:            r,
		b:            b,
		cleanupEvery: 5 * time.Minute,
		cleanupAfter: 10 * time.Minute,
	}
	go rl.cleanupLoop()
	return rl
}

func (rl *RateLimiter) get(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, ok := rl.visitors[ip]
	if !ok {
		lim := rate.NewLimiter(rl.r, rl.b)
		rl.visitors[ip] = &visitor{limiter: lim, lastSeen: time.Now()}
		return lim
	}
	v.lastSeen = time.Now()
	return v.limiter
}

func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(rl.cleanupEvery)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		for ip, v := range rl.visitors {
			if time.Since(v.lastSeen) > rl.cleanupAfter {
				delete(rl.visitors, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// RateLimit returns a middleware that applies token-bucket limiting to the
// auth endpoints defined in rateLimitedPaths. All other paths pass through.
// Returns 429 Too Many Requests when the limit is exceeded.
func RateLimit(r rate.Limit, b int) func(http.Handler) http.Handler {
	rl := NewRateLimiter(r, b)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if _, limited := rateLimitedPaths[r.URL.Path]; !limited {
				next.ServeHTTP(w, r)
				return
			}

			ip := realIP(r)
			if !rl.get(ip).Allow() {
				http.Error(w, "too many requests", http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// realIP extracts the client IP preferring X-Forwarded-For over RemoteAddr.
func realIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// X-Forwarded-For can be a comma-separated list; take the first entry.
		if idx := strings.Index(xff, ","); idx != -1 {
			return strings.TrimSpace(xff[:idx])
		}
		return strings.TrimSpace(xff)
	}
	// RemoteAddr is "host:port"
	if idx := strings.LastIndex(r.RemoteAddr, ":"); idx != -1 {
		return r.RemoteAddr[:idx]
	}
	return r.RemoteAddr
}
