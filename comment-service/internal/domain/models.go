package domain

import (
	"time"

	"github.com/google/uuid"
)

const (
	ThreadStatusActive   = "active"
	ThreadStatusResolved = "resolved"
	ThreadStatusDeleted  = "deleted"

	CommentStatusActive  = "active"
	CommentStatusDeleted = "deleted"
)

type Thread struct {
	ID              uuid.UUID  `json:"id"`
	PageID          uuid.UUID  `json:"page_id"`
	Anchor          Anchor     `json:"anchor"`
	AnchorHash      string     `json:"anchor_hash,omitempty"`
	CreatedBy       uuid.UUID  `json:"created_by"`
	Status          string     `json:"status"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	ResolvedBy      *uuid.UUID `json:"resolved_by,omitempty"`
	ResolvedAt      *time.Time `json:"resolved_at,omitempty"`
	LastCommentedAt *time.Time `json:"last_commented_at,omitempty"`
	CommentsCount   int        `json:"comments_count"`
}

type Comment struct {
	ID              uuid.UUID   `json:"id"`
	ThreadID        uuid.UUID   `json:"thread_id"`
	ParentCommentID *uuid.UUID  `json:"parent_comment_id,omitempty"`
	AuthorID        uuid.UUID   `json:"author_id"`
	Body            CommentBody `json:"body"`
	BodyText        string      `json:"body_text"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
	EditedAt        *time.Time  `json:"edited_at,omitempty"`
	DeletedAt       *time.Time  `json:"deleted_at,omitempty"`
	Status          string      `json:"status"`
}

type Mention struct {
	ID              uuid.UUID `json:"id"`
	CommentID       uuid.UUID `json:"comment_id"`
	MentionedUserID uuid.UUID `json:"mentioned_user_id"`
	CreatedAt       time.Time `json:"created_at"`
}

type ThreadSubscription struct {
	ThreadID    uuid.UUID `json:"thread_id"`
	UserID      uuid.UUID `json:"user_id"`
	IsFollowing bool      `json:"is_following"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ThreadParticipant struct {
	ThreadID  uuid.UUID `json:"thread_id"`
	UserID    uuid.UUID `json:"user_id"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ThreadWithComments struct {
	Thread   Thread    `json:"thread"`
	Comments []Comment `json:"comments"`
}
