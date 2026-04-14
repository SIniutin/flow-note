package domain

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

// ErrNotificationNotFound is returned when a notification does not exist or
// does not belong to the requesting user.
var ErrNotificationNotFound = errors.New("notification not found")

// NotificationType mirrors the proto NotificationType enum.
// Values are stored verbatim in the DB type column.
type NotificationType string

const (
	NotificationTypeMentionComment NotificationType = "mention.comment"
	NotificationTypeMentionPage    NotificationType = "mention.page"
	NotificationTypeCommentThread  NotificationType = "comment.new"
	NotificationTypeCommentReply   NotificationType = "comment.reply"
)

// Short aliases used by existing call sites and tests.
const (
	NotificationMentionComment = NotificationTypeMentionComment
	NotificationMentionPage    = NotificationTypeMentionPage
	NotificationCommentNew     = NotificationTypeCommentThread
	NotificationCommentReply   = NotificationTypeCommentReply
)

// Notification is the core domain entity.
type Notification struct {
	ID          uuid.UUID
	UserID      uuid.UUID
	Type        NotificationType
	ActorUserID *uuid.UUID
	PageID      *uuid.UUID
	ThreadID    *uuid.UUID
	CommentID   *uuid.UUID
	Payload     json.RawMessage
	DedupeKey   *string
	ReadAt      *time.Time
	CancelledAt *time.Time
	CreatedAt   time.Time
}

// ProcessedEvent is the idempotency record for an event already handled.
type ProcessedEvent struct {
	EventID     uuid.UUID
	EventType   string
	ProcessedAt time.Time
}
