package grpc

import (
	"context"

	notifyv1 "github.com/flow-note/api-contracts/generated/proto/notify/v1"
	"google.golang.org/protobuf/types/known/emptypb"
)

type Server struct {
	notifyv1.UnimplementedNotificationServiceServer
}

func New() *Server {
	return &Server{}
}

func (s *Server) GetNotifications(ctx context.Context, req *notifyv1.GetNotificationsRequest) (*notifyv1.GetNotificationsResponse, error) {
	req.ValidateAll()

}

func (s *Server) MarkRead(ctx context.Context, req *notifyv1.MarkReadRequest) (*emptypb.Empty, error) {
	req.ValidateAll()

	return &emptypb.Empty{}, nil
}

func (s *Server) MarkAllRead(ctx context.Context, req *notifyv1.MarkAllReadRequest) (*emptypb.Empty, error) {
	req.ValidateAll()

	return &emptypb.Empty{}, nil
}

func (s *Server) NotificationStream(ctx *emptypb.Empty, req notifyv1.NotificationService_StreamNotificationServer) error {

}
