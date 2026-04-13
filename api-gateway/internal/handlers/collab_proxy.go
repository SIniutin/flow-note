package handlers

import (
	"net/http"
	"net/http/httputil"
	"net/url"
)

// NewCollabProxy returns a reverse proxy that forwards /collab/* WebSocket
// connections to the collab-service. The full path is preserved so that
// hocuspocus can extract the document name from it.
//
// JWT validation for collab connections is done inside collab-service itself
// (onAuthenticate hook), so this proxy does not require an Authorization header.
// FlushInterval=-1 enables instant flushing required for WebSocket streaming.
func NewCollabProxy(target string) http.Handler {
	backend := &url.URL{
		Scheme: "http",
		Host:   target,
	}
	proxy := httputil.NewSingleHostReverseProxy(backend)
	proxy.FlushInterval = -1
	return proxy
}
