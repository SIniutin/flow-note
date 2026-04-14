package usecase

import (
	"context"
	"time"

	port "github.com/flow-note/notify-service/internal/domain/interfaces"
	"github.com/google/uuid"
)

// MarkRead marks a single notification as read for the owning user.
type MarkRead struct {
	repo port.NotificationRepository
}

func NewMarkRead(repo port.NotificationRepository) *MarkRead {
	return &MarkRead{repo: repo}
}

func (uc *MarkRead) Execute(ctx context.Context, userID, notificationID uuid.UUID) error {
	return uc.repo.MarkRead(ctx, userID, notificationID, time.Now().UTC())
}
