package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/redkindanil/flow-note/notify-service/internal/domain"
)

type NotificationRepository interface {
	SaveEventNotifications(ctx context.Context, event domain.ProcessedEvent, items []domain.Notification) (bool, error)
	ListByUser(ctx context.Context, userID uuid.UUID, unreadOnly bool, onlyMentions bool, limit, offset int) ([]domain.Notification, error)
	MarkRead(ctx context.Context, userID, notificationID uuid.UUID, at time.Time) error
	MarkAllRead(ctx context.Context, userID uuid.UUID, at time.Time) error
}
