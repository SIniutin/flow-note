package events

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

const (
	EventCommentThreadCreated  = "comment.thread.created"
	EventCommentCreated        = "comment.created"
	EventCommentReplyCreated   = "comment.reply.created"
	EventCommentMentionCreated = "comment.mention.created"
	EventThreadResolved        = "comment.thread.resolved"
	EventThreadReopened        = "comment.thread.reopened"
	EventThreadFollowed        = "comment.thread.followed"
	EventThreadUnfollowed      = "comment.thread.unfollowed"
	EventPageMentionCreated    = "page.mention.created"
)

type Envelope struct {
	EventID         uuid.UUID       `json:"event_id"`
	EventType       string          `json:"event_type"`
	OccurredAt      time.Time       `json:"occurred_at"`
	ActorUserID     *uuid.UUID      `json:"actor_user_id,omitempty"`
	PageID          *uuid.UUID      `json:"page_id,omitempty"`
	ThreadID        *uuid.UUID      `json:"thread_id,omitempty"`
	CommentID       *uuid.UUID      `json:"comment_id,omitempty"`
	ParentCommentID *uuid.UUID      `json:"parent_comment_id,omitempty"`
	MentionedUserID *uuid.UUID      `json:"mentioned_user_id,omitempty"`
	RecipientsHint  []uuid.UUID     `json:"recipients_hint,omitempty"`
	Anchor          json.RawMessage `json:"anchor,omitempty"`
	Preview         string          `json:"preview,omitempty"`
	DedupeKey       string          `json:"dedupe_key,omitempty"`
	Payload         json.RawMessage `json:"payload,omitempty"`
}

func (e *Envelope) RoutingKey() string {
	return e.EventType
}
