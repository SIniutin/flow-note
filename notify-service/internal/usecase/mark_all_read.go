package usecase

import (
	"context"
	"time"

	port "github.com/flow-note/notify-service/internal/domain/interfaces"
	"github.com/google/uuid"
)

// MarkAllRead marks every unread notification for a user as read.
type MarkAllRead struct {
	repo port.NotificationRepository
}

func NewMarkAllRead(repo port.NotificationRepository) *MarkAllRead {
	return &MarkAllRead{repo: repo}
}

func (uc *MarkAllRead) Execute(ctx context.Context, userID uuid.UUID) error {
	return uc.repo.MarkAllRead(ctx, userID, time.Now().UTC())
}
