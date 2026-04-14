package grpc

import (
	"context"
	"encoding/json"
	"time"

	notifyv1 "github.com/flow-note/api-contracts/generated/notify/v1"
	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/realtime"
	"github.com/flow-note/notify-service/internal/domain"
	"github.com/flow-note/notify-service/internal/service"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type Server struct {
	notifyv1.UnimplementedNotifyServiceServer
	svc *service.Service
	rt  realtime.Subscriber
}

func New(svc *service.Service, rt realtime.Subscriber) *Server {
	return &Server{svc: svc, rt: rt}
}

func (s *Server) ListNotifications(ctx context.Context, req *notifyv1.ListNotificationsRequest) (*notifyv1.ListNotificationsResponse, error) {
	userID, err := actorFromContext(ctx)
	if err != nil {
		return nil, err
	}
	limit := int(req.GetLimit())
	if limit <= 0 {
		limit = 20
	}
	items, err := s.svc.ListNotifications(ctx, userID, req.GetUnreadOnly(), req.GetOnlyMentions(), limit, int(req.GetOffset()))
	if err != nil {
		return nil, err
	}
	out := make([]*notifyv1.Notification, 0, len(items))
	for _, item := range items {
		out = append(out, toProtoNotification(item))
	}
	return &notifyv1.ListNotificationsResponse{Items: out}, nil
}

func (s *Server) MarkRead(ctx context.Context, req *notifyv1.MarkReadRequest) (*emptypb.Empty, error) {
	userID, err := actorFromContext(ctx)
	if err != nil {
		return nil, err
	}
	id, err := parseUUID(req.GetNotificationId(), "notification_id")
	if err != nil {
		return nil, err
	}
	if err := s.svc.MarkRead(ctx, userID, id); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func (s *Server) MarkAllRead(ctx context.Context, _ *notifyv1.MarkAllReadRequest) (*emptypb.Empty, error) {
	userID, err := actorFromContext(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.svc.MarkAllRead(ctx, userID); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func (s *Server) NotificationStream(req *notifyv1.NotificationStreamRequest, stream notifyv1.NotifyService_NotificationStreamServer) error {
	userID, err := actorFromContext(stream.Context())
	if err != nil {
		return err
	}
	ch, err := s.rt.SubscribeUser(stream.Context(), userChannel(userID))
	if err != nil {
		return err
	}
	for {
		select {
		case <-stream.Context().Done():
			return stream.Context().Err()
		case msg, ok := <-ch:
			if !ok {
				return nil
			}
			var item domain.RealtimeMessage
			if err := json.Unmarshal(msg, &item); err != nil {
				continue
			}
			if err := stream.Send(&notifyv1.NotificationEvent{Notification: toProtoRealtime(item)}); err != nil {
				return err
			}
		}
	}
}

func actorFromContext(ctx context.Context) (uuid.UUID, error) {
	actorID, ok := authctx.UserID(ctx)
	if !ok || actorID == uuid.Nil {
		return uuid.Nil, status.Error(codes.Unauthenticated, "missing x-user-id metadata")
	}
	return actorID, nil
}

func parseUUID(raw, field string) (uuid.UUID, error) {
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, status.Errorf(codes.InvalidArgument, "invalid %s", field)
	}
	return id, nil
}

func userChannel(userID uuid.UUID) string {
	return "notifications:" + userID.String()
}

func toProtoNotification(item domain.Notification) *notifyv1.Notification {
	msg := &notifyv1.Notification{
		Id:          item.ID.String(),
		UserId:      item.UserID.String(),
		Type:        item.Type,
		PayloadJson: string(item.Payload),
		Read:        item.ReadAt != nil,
		CreatedAt:   timestamppb.New(item.CreatedAt),
		ReadAt:      tsPtr(item.ReadAt),
	}
	if item.ActorUserID != nil {
		value := item.ActorUserID.String()
		msg.ActorUserId = &value
	}
	if item.PageID != nil {
		value := item.PageID.String()
		msg.PageId = &value
	}
	if item.ThreadID != nil {
		value := item.ThreadID.String()
		msg.ThreadId = &value
	}
	if item.CommentID != nil {
		value := item.CommentID.String()
		msg.CommentId = &value
	}
	return msg
}

func toProtoRealtime(item domain.RealtimeMessage) *notifyv1.Notification {
	msg := &notifyv1.Notification{
		Id:          item.NotificationID.String(),
		UserId:      item.UserID.String(),
		Type:        item.Type,
		PayloadJson: string(item.Payload),
		Read:        false,
		CreatedAt:   timestamppb.New(item.CreatedAt),
	}
	if item.PageID != nil {
		value := item.PageID.String()
		msg.PageId = &value
	}
	if item.ThreadID != nil {
		value := item.ThreadID.String()
		msg.ThreadId = &value
	}
	if item.CommentID != nil {
		value := item.CommentID.String()
		msg.CommentId = &value
	}
	return msg
}

func tsPtr(t *time.Time) *timestamppb.Timestamp {
	if t == nil {
		return nil
	}
	return timestamppb.New(*t)
}
