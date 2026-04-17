package httpauth

import (
	"net/http"

	"github.com/flow-note/common/authsecurity"

	"github.com/flow-note/common/authctx"
)

const AccessTokenCookieName = "access_token"

// Middleware for authorization checking and adding user_id in ctx
func AuthJWT(next http.Handler, v authsecurity.Verifier, whitelist map[string]struct{}) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}

		if _, ok := whitelist[r.URL.Path]; ok {
			next.ServeHTTP(w, r)
			return
		}

		token := ExtractAccessToken(r)
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
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func ExtractAccessToken(r *http.Request) string {
	if token := ExtractBearer(r.Header.Get("Authorization")); token != "" {
		return token
	}

	c, err := r.Cookie(AccessTokenCookieName)
	if err == nil && c.Value != "" {
		return c.Value
	}

	// ?token= query param — used by EventSource which cannot set custom headers.
	if token := r.URL.Query().Get("token"); token != "" {
		return token
	}

	return ""
}
