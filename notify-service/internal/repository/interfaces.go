package repository

import (
	"context"
	"time"

	"github.com/flow-note/notify-service/internal/domain"
	"github.com/google/uuid"
)

type NotificationRepository interface {
	SaveEventNotifications(ctx context.Context, event domain.ProcessedEvent, items []domain.Notification) (bool, error)
	ListByUser(ctx context.Context, userID uuid.UUID, unreadOnly bool, onlyMentions bool, limit, offset int) ([]domain.Notification, error)
	MarkRead(ctx context.Context, userID, notificationID uuid.UUID, at time.Time) error
	MarkAllRead(ctx context.Context, userID uuid.UUID, at time.Time) error
}
