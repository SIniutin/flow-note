package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/flow-note/common/broker"
	"github.com/flow-note/notify-service/internal/domain"
	port "github.com/flow-note/notify-service/internal/domain/interfaces"
	"github.com/google/uuid"
)

// ProcessEvent converts an incoming domain event into a notification,
// persists it idempotently, and delivers it in real-time to the recipient.
type ProcessEvent struct {
	repo      port.NotificationRepository
	publisher port.EventPublisher
}

func NewProcessEvent(repo port.NotificationRepository, publisher port.EventPublisher) *ProcessEvent {
	return &ProcessEvent{repo: repo, publisher: publisher}
}

func (uc *ProcessEvent) Execute(ctx context.Context, eventID uuid.UUID, event broker.Event) error {
	n, err := uc.route(event)
	if err != nil {
		return err
	}
	if n == nil {
		return nil
	}

	saved, err := uc.repo.SaveEventNotifications(ctx, domain.ProcessedEvent{
		EventID:     eventID,
		EventType:   string(event.Type),
		ProcessedAt: time.Now().UTC(),
	}, []domain.Notification{*n})
	if err != nil {
		return err
	}
	if !saved {
		// Already processed — idempotency guard.
		return nil
	}

	if uc.publisher == nil {
		return nil
	}
	channel := "notifications:" + n.UserID.String()
	return uc.publisher.PublishUser(ctx, channel, *n)
}

func (uc *ProcessEvent) route(event broker.Event) (*domain.Notification, error) {
	userID, err := uuid.Parse(event.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id %q: %w", event.UserID, err)
	}

	var kind domain.NotificationType
	switch event.Type {
	case broker.EventMentionComment, broker.EventCommentMention:
		kind = domain.NotificationMentionComment
	case broker.EventMentionPage:
		kind = domain.NotificationMentionPage
	case broker.EventCommentThread:
		kind = domain.NotificationCommentNew
	case broker.EventCommentReply:
		kind = domain.NotificationCommentReply
	default:
		return nil, nil
	}

	n := &domain.Notification{
		ID:        uuid.New(),
		UserID:    userID,
		Type:      kind,
		CreatedAt: time.Now().UTC(),
	}

	if event.ActorID != "" {
		if id, err := uuid.Parse(event.ActorID); err == nil {
			n.ActorUserID = &id
		}
	}
	if event.PageID != "" {
		if id, err := uuid.Parse(event.PageID); err == nil {
			n.PageID = &id
		}
	}
	if event.EntityID != "" {
		if id, err := uuid.Parse(event.EntityID); err == nil {
			n.CommentID = &id
		}
	}

	payload, err := buildPayload(event)
	if err != nil {
		return nil, err
	}
	n.Payload = payload

	return n, nil
}

func buildPayload(event broker.Event) (json.RawMessage, error) {
	m := map[string]any{}
	if event.PageID != "" {
		m["page_id"] = event.PageID
	}
	if event.EntityID != "" {
		m["entity_id"] = event.EntityID
	}
	return json.Marshal(m)
}