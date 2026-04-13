package grpcserver

import (
	"net"

	"google.golang.org/grpc"
)

type Server struct {
	inner    *grpc.Server
	listener net.Listener
}

func New(addr string, opts ...grpc.ServerOption) (*Server, error) {
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, err
	}
	return &Server{
		inner:    grpc.NewServer(opts...),
		listener: lis,
	}, nil
}

func (s *Server) Inner() *grpc.Server {
	return s.inner
}

func (s *Server) Serve() error {
	return s.inner.Serve(s.listener)
}

func (s *Server) GracefulStop() {
	s.inner.GracefulStop()
}
