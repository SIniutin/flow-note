package grpc

import (
	"context"
	"encoding/json"

	notificationsv1 "github.com/flow-note/api-contracts/generated/proto/notify/v1"
	"github.com/flow-note/common/authctx"
	"github.com/flow-note/notify-service/internal/domain"
	"github.com/flow-note/notify-service/internal/domain/port"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	emptypb "google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// ── Use-case ports (inbound side) ────────────────────────────────────────────

type notificationGetter interface {
	Execute(ctx context.Context, userID uuid.UUID, unreadOnly bool, limit int) ([]domain.Notification, error)
}

type notificationReadMarker interface {
	Execute(ctx context.Context, userID, notificationID uuid.UUID) error
}

type allNotificationsReadMarker interface {
	Execute(ctx context.Context, userID uuid.UUID) error
}

// ── Handler ───────────────────────────────────────────────────────────────────

// Handler is the gRPC inbound adapter for the NotificationService.
type Handler struct {
	notificationsv1.UnimplementedNotificationServiceServer
	getNotifications notificationGetter
	markRead         notificationReadMarker
	markAllRead      allNotificationsReadMarker
	subscriber       port.EventSubscriber
}

func New(
	getNotifications notificationGetter,
	markRead notificationReadMarker,
	markAllRead allNotificationsReadMarker,
	subscriber port.EventSubscriber,
) *Handler {
	return &Handler{
		getNotifications: getNotifications,
		markRead:         markRead,
		markAllRead:      markAllRead,
		subscriber:       subscriber,
	}
}

// ── RPC implementations ───────────────────────────────────────────────────────

func (h *Handler) GetNotifications(
	ctx context.Context,
	req *notificationsv1.GetNotificationsRequest,
) (*notificationsv1.GetNotificationsResponse, error) {
	userID, err := authctx.ParseUserIDFromCtx(ctx)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "missing user context")
	}

	items, err := h.getNotifications.Execute(ctx, userID, req.GetUnreadOnly(), int(req.GetPageSize()))
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	result := make([]*notificationsv1.Notification, 0, len(items))
	for _, item := range items {
		result = append(result, toProto(item))
	}
	return &notificationsv1.GetNotificationsResponse{Notifications: result}, nil
}

func (h *Handler) MarkRead(
	ctx context.Context,
	req *notificationsv1.MarkReadRequest,
) (*emptypb.Empty, error) {
	userID, err := authctx.ParseUserIDFromCtx(ctx)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "missing user context")
	}

	notificationID, err := uuid.Parse(req.GetNotificationId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid notification id")
	}

	if err := h.markRead.Execute(ctx, userID, notificationID); err != nil {
		if err == domain.ErrNotificationNotFound {
			return nil, status.Error(codes.NotFound, "notification not found")
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &emptypb.Empty{}, nil
}

func (h *Handler) MarkAllRead(
	ctx context.Context,
	_ *notificationsv1.MarkAllReadRequest,
) (*emptypb.Empty, error) {
	userID, err := authctx.ParseUserIDFromCtx(ctx)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "missing user context")
	}

	if err := h.markAllRead.Execute(ctx, userID); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &emptypb.Empty{}, nil
}

// StreamNotification subscribes the caller to their personal Redis notification
// channel and streams events until the client disconnects or the context is cancelled.
func (h *Handler) StreamNotification(
	_ *emptypb.Empty,
	stream notificationsv1.NotificationService_StreamNotificationServer,
) error {
	ctx := stream.Context()

	userID, err := authctx.ParseUserIDFromCtx(ctx)
	if err != nil {
		return status.Error(codes.Unauthenticated, "missing user context")
	}

	channel := "notifications:" + userID.String()
	ch, err := h.subscriber.SubscribeUser(ctx, channel)
	if err != nil {
		return status.Error(codes.Internal, "failed to subscribe")
	}

	for {
		select {
		case <-ctx.Done():
			return nil
		case raw, ok := <-ch:
			if !ok {
				return nil
			}
			var n domain.Notification
			if err := json.Unmarshal(raw, &n); err != nil {
				// Malformed message — skip rather than kill the stream.
				continue
			}
			if err := stream.Send(toProto(n)); err != nil {
				return err
			}
		}
	}
}

// ── Mapping helpers ───────────────────────────────────────────────────────────

func toProto(n domain.Notification) *notificationsv1.Notification {
	payload := &notificationsv1.NotificationPayload{}
	if n.PageID != nil {
		payload.PageId = n.PageID.String()
	}

	// entity_id lives inside the JSON payload blob.
	var raw map[string]any
	if len(n.Payload) > 0 && json.Unmarshal(n.Payload, &raw) == nil {
		if entityID, ok := raw["entity_id"].(string); ok && entityID != "" {
			payload.EntityId = &entityID
		}
		if payload.PageId == "" {
			if pageID, ok := raw["page_id"].(string); ok {
				payload.PageId = pageID
			}
		}
	}

	proto := &notificationsv1.Notification{
		Id:        n.ID.String(),
		UserId:    n.UserID.String(),
		Type:      toProtoType(n.Type),
		Payload:   payload,
		CreatedAt: timestamppb.New(n.CreatedAt),
	}
	if n.ActorUserID != nil {
		s := n.ActorUserID.String()
		proto.ActorUserId = &s
	}
	if n.ReadAt != nil {
		proto.ReadAt = timestamppb.New(*n.ReadAt)
	}
	if n.CancelledAt != nil {
		proto.CancelledAt = timestamppb.New(*n.CancelledAt)
	}
	return proto
}

func toProtoType(kind domain.NotificationType) notificationsv1.NotificationType {
	switch kind {
	case domain.NotificationTypeMentionComment:
		return notificationsv1.NotificationType_NOTIFICATION_TYPE_MENTION_COMMENT
	case domain.NotificationTypeMentionPage:
		return notificationsv1.NotificationType_NOTIFICATION_TYPE_MENTION_PAGE
	case domain.NotificationTypeCommentReply:
		return notificationsv1.NotificationType_NOTIFICATION_TYPE_COMMENT_REPLY
	case domain.NotificationTypeCommentThread:
		return notificationsv1.NotificationType_NOTIFICATION_TYPE_COMMENT_THREAD
	default:
		return notificationsv1.NotificationType_NOTIFICATION_TYPE_UNSPECIFIED
	}
}
