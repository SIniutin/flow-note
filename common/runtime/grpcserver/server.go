package grpcserver

import (
	"fmt"
	"net"

	"google.golang.org/grpc"
)

// Server wraps a gRPC server with its listen address.
type Server struct {
	srv  *grpc.Server
	addr string
}

// New creates a gRPC server that will listen on addr.
func New(addr string, opts ...grpc.ServerOption) (*Server, error) {
	if addr == "" {
		return nil, fmt.Errorf("grpcserver: addr is empty")
	}
	return &Server{srv: grpc.NewServer(opts...), addr: addr}, nil
}

// Inner returns the underlying *grpc.Server for service registration.
func (s *Server) Inner() *grpc.Server { return s.srv }

// Serve binds the TCP listener and starts serving. Blocks until the server stops.
func (s *Server) Serve() error {
	lis, err := net.Listen("tcp", s.addr)
	if err != nil {
		return fmt.Errorf("grpcserver listen %s: %w", s.addr, err)
	}
	return s.srv.Serve(lis)
}

// GracefulStop stops the server gracefully.
func (s *Server) GracefulStop() { s.srv.GracefulStop() }
