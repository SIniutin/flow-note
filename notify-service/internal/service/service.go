package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/flow-note/common/events"
	commonrt "github.com/flow-note/common/realtime"
	"github.com/flow-note/notify-service/internal/domain"
	"github.com/flow-note/notify-service/internal/repository"
	"github.com/google/uuid"
)

type Service struct {
	notifications repository.NotificationRepository
	realtime      commonrt.Publisher
}

func New(
	notifications repository.NotificationRepository,
	realtime commonrt.Publisher,
) *Service {
	return &Service{
		notifications: notifications,
		realtime:      realtime,
	}
}

func (s *Service) ProcessEvent(ctx context.Context, envelope events.Envelope) error {
	items, err := s.route(ctx, envelope)
	if err != nil {
		return err
	}
	saved, err := s.notifications.SaveEventNotifications(ctx, domain.ProcessedEvent{
		EventID: envelope.EventID, EventType: envelope.EventType, ProcessedAt: time.Now().UTC(),
	}, items)
	if err != nil {
		return err
	}
	if !saved {
		return nil
	}
	for _, item := range items {
		rt := domain.RealtimeMessage{
			NotificationID: item.ID,
			UserID:         item.UserID,
			Type:           item.Type,
			PageID:         item.PageID,
			ThreadID:       item.ThreadID,
			CommentID:      item.CommentID,
			Payload:        item.Payload,
			CreatedAt:      item.CreatedAt,
		}
		_ = s.realtime.PublishUser(ctx, userChannel(item.UserID), rt)
	}
	return nil
}

func (s *Service) ListNotifications(ctx context.Context, userID uuid.UUID, unreadOnly, onlyMentions bool, limit, offset int) ([]domain.Notification, error) {
	return s.notifications.ListByUser(ctx, userID, unreadOnly, onlyMentions, limit, offset)
}

func (s *Service) MarkRead(ctx context.Context, userID, id uuid.UUID) error {
	return s.notifications.MarkRead(ctx, userID, id, time.Now().UTC())
}

func (s *Service) MarkAllRead(ctx context.Context, userID uuid.UUID) error {
	return s.notifications.MarkAllRead(ctx, userID, time.Now().UTC())
}

func userChannel(userID uuid.UUID) string {
	return fmt.Sprintf("notifications:%s", userID.String())
}

func (s *Service) route(ctx context.Context, envelope events.Envelope) ([]domain.Notification, error) {
	if envelope.PageID == nil {
		return nil, nil
	}
	recipients := map[uuid.UUID]string{}
	switch envelope.EventType {
	case events.EventCommentMentionCreated:
		if envelope.MentionedUserID != nil {
			recipients[*envelope.MentionedUserID] = domain.NotificationMentionComment
		}
	case events.EventPageMentionCreated:
		if envelope.MentionedUserID != nil {
			recipients[*envelope.MentionedUserID] = domain.NotificationMentionPage
		}
	case events.EventCommentCreated:
		for _, userID := range envelope.RecipientsHint {
			recipients[userID] = domain.NotificationCommentNew
		}
	case events.EventCommentReplyCreated:
		for _, userID := range envelope.RecipientsHint {
			recipients[userID] = domain.NotificationCommentReply
		}
	}
	items := make([]domain.Notification, 0, len(recipients))
	for userID, notifType := range recipients {
		if envelope.ActorUserID != nil && userID == *envelope.ActorUserID {
			continue
		}
		payload, _ := json.Marshal(map[string]any{
			"page_id":    envelope.PageID,
			"thread_id":  envelope.ThreadID,
			"comment_id": envelope.CommentID,
			"anchor":     json.RawMessage(envelope.Anchor),
			"preview":    envelope.Preview,
		})
		dedupeKey := envelope.DedupeKey
		if dedupeKey == "" {
			dedupeKey = fmt.Sprintf("%s:%s:%s", notifType, envelope.EventID, userID)
		} else {
			dedupeKey = fmt.Sprintf("%s:%s", dedupeKey, userID)
		}
		items = append(items, domain.Notification{
			ID:          uuid.New(),
			UserID:      userID,
			Type:        notifType,
			ActorUserID: envelope.ActorUserID,
			PageID:      envelope.PageID,
			ThreadID:    envelope.ThreadID,
			CommentID:   envelope.CommentID,
			Payload:     payload,
			DedupeKey:   &dedupeKey,
			CreatedAt:   time.Now().UTC(),
		})
	}
	return items, nil
}
