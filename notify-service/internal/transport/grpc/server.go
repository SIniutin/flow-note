package grpc

import (
	"context"

	notifyv1 "github.com/flow-note/api-contracts/generated/proto/notify/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

type Server struct {
	notifyv1.UnimplementedNotifyServiceServer
}

func New() *Server {
	return &Server{}
}

func (s *Server) ListNotifications(_ context.Context, _ *notifyv1.ListNotificationsRequest) (*notifyv1.ListNotificationsResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not implemented")
}

func (s *Server) MarkRead(_ context.Context, _ *notifyv1.MarkReadRequest) (*emptypb.Empty, error) {
	return nil, status.Error(codes.Unimplemented, "not implemented")
}

func (s *Server) MarkAllRead(_ context.Context, _ *notifyv1.MarkAllReadRequest) (*emptypb.Empty, error) {
	return nil, status.Error(codes.Unimplemented, "not implemented")
}

func (s *Server) NotificationStream(_ *notifyv1.NotificationStreamRequest, _ notifyv1.NotifyService_NotificationStreamServer) error {
	return status.Error(codes.Unimplemented, "not implemented")
}
