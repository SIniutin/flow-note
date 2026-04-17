package httpauth

import (
	"net/http"
	"strings"
)

// ExtractBearer returns the token from a standard Authorization header.
func ExtractBearer(auth string) string {
	const prefix = "Bearer "
	if !strings.HasPrefix(auth, prefix) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(auth, prefix))
}

// TokenFromRequest returns the bearer token from the request Authorization header.
func TokenFromRequest(r *http.Request) string {
	if r == nil {
		return ""
	}
	return ExtractBearer(r.Header.Get("Authorization"))
}
