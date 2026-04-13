package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

const (
	NotificationMentionPage    = "mention.page"
	NotificationMentionComment = "mention.comment"
	NotificationCommentNew     = "comment.new"
	NotificationCommentReply   = "comment.reply"
)

type Notification struct {
	ID          uuid.UUID       `json:"id"`
	UserID      uuid.UUID       `json:"user_id"`
	Type        string          `json:"type"`
	ActorUserID *uuid.UUID      `json:"actor_user_id,omitempty"`
	PageID      *uuid.UUID      `json:"page_id,omitempty"`
	ThreadID    *uuid.UUID      `json:"thread_id,omitempty"`
	CommentID   *uuid.UUID      `json:"comment_id,omitempty"`
	Payload     json.RawMessage `json:"payload"`
	DedupeKey   *string         `json:"dedupe_key,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
	ReadAt      *time.Time      `json:"read_at,omitempty"`
	CancelledAt *time.Time      `json:"cancelled_at,omitempty"`
}

type ProcessedEvent struct {
	EventID     uuid.UUID `json:"event_id"`
	EventType   string    `json:"event_type"`
	ProcessedAt time.Time `json:"processed_at"`
}

type RealtimeMessage struct {
	NotificationID uuid.UUID       `json:"notification_id"`
	UserID         uuid.UUID       `json:"user_id"`
	Type           string          `json:"type"`
	PageID         *uuid.UUID      `json:"page_id,omitempty"`
	ThreadID       *uuid.UUID      `json:"thread_id,omitempty"`
	CommentID      *uuid.UUID      `json:"comment_id,omitempty"`
	Payload        json.RawMessage `json:"payload"`
	CreatedAt      time.Time       `json:"created_at"`
}
