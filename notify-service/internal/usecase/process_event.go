package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/flow-note/common/events"
	"github.com/flow-note/notify-service/internal/domain"
	"github.com/flow-note/notify-service/internal/domain/port"
	"github.com/google/uuid"
)

// ProcessEvent converts an incoming domain event into one or more notifications,
// persists them idempotently, and fans out real-time delivery per recipient.
type ProcessEvent struct {
	repo      port.NotificationRepository
	publisher port.EventPublisher
}

func NewProcessEvent(repo port.NotificationRepository, publisher port.EventPublisher) *ProcessEvent {
	return &ProcessEvent{repo: repo, publisher: publisher}
}

func (uc *ProcessEvent) Execute(ctx context.Context, envelope events.Envelope) error {
	items, err := uc.route(ctx, envelope)
	if err != nil {
		return err
	}
	if len(items) == 0 {
		return nil
	}

	saved, err := uc.repo.SaveEventNotifications(ctx, domain.ProcessedEvent{
		EventID:     envelope.EventID,
		EventType:   envelope.EventType,
		ProcessedAt: time.Now().UTC(),
	}, items)
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
	for _, item := range items {
		channel := "notifications:" + item.UserID.String()
		if err := uc.publisher.PublishUser(ctx, channel, item); err != nil {
			return err
		}
	}

	return nil
}

func (uc *ProcessEvent) route(_ context.Context, envelope events.Envelope) ([]domain.Notification, error) {
	basePayload, err := buildPayload(envelope)
	if err != nil {
		return nil, err
	}

	make_ := func(userID uuid.UUID, kind domain.NotificationType) domain.Notification {
		n := domain.Notification{
			ID:          uuid.New(),
			UserID:      userID,
			Type:        kind,
			ActorUserID: envelope.ActorUserID,
			PageID:      envelope.PageID,
			ThreadID:    envelope.ThreadID,
			CommentID:   envelope.CommentID,
			Payload:     basePayload,
			CreatedAt:   envelope.OccurredAt,
		}
		if n.CreatedAt.IsZero() {
			n.CreatedAt = time.Now().UTC()
		}
		if envelope.DedupeKey != "" {
			key := fmt.Sprintf("%s:%s", envelope.DedupeKey, userID.String())
			n.DedupeKey = &key
		}
		return n
	}

	switch envelope.EventType {
	case events.EventCommentMentionCreated:
		if envelope.MentionedUserID == nil {
			return nil, nil
		}
		return []domain.Notification{make_(*envelope.MentionedUserID, domain.NotificationMentionComment)}, nil

	case events.EventPageMentionCreated:
		if envelope.MentionedUserID == nil {
			return nil, nil
		}
		return []domain.Notification{make_(*envelope.MentionedUserID, domain.NotificationMentionPage)}, nil

	case events.EventCommentCreated, events.EventCommentReplyCreated:
		kind := domain.NotificationCommentNew
		if envelope.EventType == events.EventCommentReplyCreated {
			kind = domain.NotificationCommentReply
		}
		items := make([]domain.Notification, 0, len(envelope.RecipientsHint))
		for _, recipient := range envelope.RecipientsHint {
			items = append(items, make_(recipient, kind))
		}
		return items, nil

	default:
		return nil, nil
	}
}

func buildPayload(envelope events.Envelope) (json.RawMessage, error) {
	payload := map[string]any{}
	if envelope.PageID != nil {
		payload["page_id"] = envelope.PageID.String()
	}
	if envelope.CommentID != nil {
		payload["entity_id"] = envelope.CommentID.String()
	} else if envelope.ThreadID != nil {
		payload["entity_id"] = envelope.ThreadID.String()
	}
	if len(envelope.Payload) > 0 {
		payload["event_payload"] = json.RawMessage(envelope.Payload)
	}
	if envelope.Preview != "" {
		payload["preview"] = envelope.Preview
	}
	return json.Marshal(payload)
}
