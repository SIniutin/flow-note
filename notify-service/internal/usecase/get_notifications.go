package usecase

import (
	"context"

	"github.com/flow-note/notify-service/internal/domain"
	"github.com/flow-note/notify-service/internal/domain/port"
	"github.com/google/uuid"
)

// GetNotifications returns a user's notification feed.
type GetNotifications struct {
	repo port.NotificationRepository
}

func NewGetNotifications(repo port.NotificationRepository) *GetNotifications {
	return &GetNotifications{repo: repo}
}

func (uc *GetNotifications) Execute(
	ctx context.Context,
	userID uuid.UUID,
	unreadOnly bool,
	limit int,
) ([]domain.Notification, error) {
	if limit <= 0 {
		limit = 20
	}
	return uc.repo.ListByUser(ctx, userID, port.ListFilter{
		UnreadOnly: unreadOnly,
		Limit:      limit,
	})
}
