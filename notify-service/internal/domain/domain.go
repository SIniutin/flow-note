package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

const (
	NotificationMentionComment = "mention.comment"
	NotificationMentionPage    = "mention.page"
	NotificationCommentNew     = "comment.new"
	NotificationCommentReply   = "comment.reply"
)

// Notification is a single notification record stored in the database.
type Notification struct {
	ID          uuid.UUID
	UserID      uuid.UUID
	Type        string
	ActorUserID *uuid.UUID
	PageID      *uuid.UUID
	ThreadID    *uuid.UUID
	CommentID   *uuid.UUID
	Payload     json.RawMessage
	DedupeKey   *string
	CreatedAt   time.Time
	ReadAt      *time.Time
	CancelledAt *time.Time
}

// ProcessedEvent tracks event idempotency — used to prevent duplicate notifications.
type ProcessedEvent struct {
	EventID     uuid.UUID
	EventType   string
	ProcessedAt time.Time
}

// RealtimeMessage is published to Redis so connected clients receive live notifications.
type RealtimeMessage struct {
	NotificationID uuid.UUID       `json:"notification_id"`
	UserID         uuid.UUID       `json:"user_id"`
	Type           string          `json:"type"`
	PageID         *uuid.UUID      `json:"page_id,omitempty"`
	ThreadID       *uuid.UUID      `json:"thread_id,omitempty"`
	CommentID      *uuid.UUID      `json:"comment_id,omitempty"`
	Payload        json.RawMessage `json:"payload,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}
