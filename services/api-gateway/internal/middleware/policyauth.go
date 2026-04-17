package middleware

import (
	"net/http"
	"strings"

	p "github.com/flow-note/api-gateway/internal/policy"
	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/authsecurity"
	"github.com/flow-note/common/httpauth"
)

// PolicyAuth replaces the simple whitelist-based AuthJWT.
// It matches "METHOD /path" against the policies map (supports {param} wildcards).
// Unmatched routes default to AuthOnly.
// Execution order for a request: OPTIONS pass-through → policy lookup → JWT validation → role check → next.
func PolicyAuth(next http.Handler, v authsecurity.Verifier, policies map[string]p.Policy) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}

		pol := matchPolicy(r.Method, r.URL.Path, policies)

		if pol.Mode == p.Public {
			next.ServeHTTP(w, r)
			return
		}

		// AuthOnly or AuthWithRoles — JWT required
		token := httpauth.ExtractAccessToken(r)
		if token == "" {
			http.Error(w, "missing access token", http.StatusUnauthorized)
			return
		}

		userID, role, err := v.VerifyAccess(token)
		if err != nil {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		ctx := authctx.WithAuthInfo(r.Context(), authctx.AuthInfo{
			UserID: userID,
			Role:   role,
		})

		if pol.Mode == p.AuthWithRoles {
			if _, ok := pol.RequiredRoles[role]; !ok {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
		}

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// matchPolicy finds the best matching policy for the given method+path.
// Keys in the map are "METHOD /path/with/{param}/segments".
// Exact matches win over wildcard matches.
func matchPolicy(method, path string, policies map[string]p.Policy) p.Policy {
	key := method + " " + path
	if pol, ok := policies[key]; ok {
		return pol
	}

	// Wildcard match: replace {param} segments with the actual path segments
	for pattern, pol := range policies {
		parts := strings.SplitN(pattern, " ", 2)
		if len(parts) != 2 {
			continue
		}
		if parts[0] != method {
			continue
		}
		if matchPath(parts[1], path) {
			return pol
		}
	}

	// Default: require JWT, no role constraint
	return p.Policy{Mode: p.AuthOnly}
}

// matchPath returns true if urlPath matches pattern, treating {param} as a
// single path segment wildcard (does not match "/").
func matchPath(pattern, urlPath string) bool {
	ps := strings.Split(strings.Trim(pattern, "/"), "/")
	us := strings.Split(strings.Trim(urlPath, "/"), "/")
	if len(ps) != len(us) {
		return false
	}
	for i, seg := range ps {
		if strings.HasPrefix(seg, "{") && strings.HasSuffix(seg, "}") {
			continue // wildcard segment
		}
		if seg != us[i] {
			return false
		}
	}
	return true
}
