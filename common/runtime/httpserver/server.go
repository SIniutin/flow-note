package httpserver

import (
	"context"
	"net/http"
	"time"
)

type Server struct {
	inner *http.Server
}

func New(addr string, handler http.Handler) *Server {
	return &Server{
		inner: &http.Server{
			Addr:              addr,
			Handler:           handler,
			ReadHeaderTimeout: 5 * time.Second,
		},
	}
}

func (s *Server) ListenAndServe() error {
	return s.inner.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.inner.Shutdown(ctx)
}
