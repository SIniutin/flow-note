package domain

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
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

// ─── Anchor ──────────────────────────────────────────────────────────────────

type Anchor struct {
	Kind          string `json:"kind"`
	BlockID       string `json:"block_id,omitempty"`
	StartOffset   *int   `json:"start_offset,omitempty"`
	EndOffset     *int   `json:"end_offset,omitempty"`
	SelectedText  string `json:"selected_text,omitempty"`
	ContextBefore string `json:"context_before,omitempty"`
	ContextAfter  string `json:"context_after,omitempty"`
	SnapshotID    string `json:"snapshot_id,omitempty"`
	TableID       string `json:"table_id,omitempty"`
	RowID         string `json:"row_id,omitempty"`
	ColumnID      string `json:"column_id,omitempty"`
}

// Validate returns an error if the anchor is semantically invalid.
func (a *Anchor) Validate() error {
	if a.Kind == "" {
		return errors.New("anchor kind is required")
	}
	return nil
}

// Hash returns a short deterministic fingerprint of the anchor for deduplication.
func (a *Anchor) Hash() (string, error) {
	b, err := json.Marshal(a)
	if err != nil {
		return "", fmt.Errorf("anchor hash: %w", err)
	}
	sum := sha256.Sum256(b)
	return fmt.Sprintf("%x", sum[:8]), nil
}

// ─── CommentBody ─────────────────────────────────────────────────────────────

type BodyNode struct {
	Type   string     `json:"type"`
	Text   string     `json:"text,omitempty"`
	Label  string     `json:"label,omitempty"`
	UserID *uuid.UUID `json:"user_id,omitempty"`
}

type CommentBody []BodyNode

// Validate returns true if the body contains at least one non-empty node.
func (b *CommentBody) Validate() bool {
	for _, node := range *b {
		if strings.TrimSpace(node.Text) != "" || node.Type == "mention" {
			return true
		}
	}
	return false
}

// PlainTextPreview returns a plain-text preview truncated to maxLen runes.
func (b *CommentBody) PlainTextPreview(maxLen int) string {
	var sb strings.Builder
	for _, node := range *b {
		if node.Text != "" {
			sb.WriteString(node.Text)
		} else if node.Label != "" {
			sb.WriteString(node.Label)
		}
	}
	s := sb.String()
	runes := []rune(s)
	if len(runes) > maxLen {
		return string(runes[:maxLen])
	}
	return s
}

// MentionedUserIDs returns all user IDs referenced in mention nodes.
func (b *CommentBody) MentionedUserIDs() []uuid.UUID {
	out := make([]uuid.UUID, 0)
	for _, node := range *b {
		if node.Type == "mention" && node.UserID != nil {
			out = append(out, *node.UserID)
		}
	}
	return out
}

// ─── Thread ──────────────────────────────────────────────────────────────────

type Thread struct {
	ID              uuid.UUID
	PageID          uuid.UUID
	Anchor          Anchor
	AnchorHash      string
	CreatedBy       uuid.UUID
	Status          string
	CreatedAt       time.Time
	UpdatedAt       time.Time
	ResolvedBy      *uuid.UUID
	ResolvedAt      *time.Time
	LastCommentedAt *time.Time
	CommentsCount   int
}

type ThreadWithComments struct {
	Thread   Thread
	Comments []Comment
}

// ─── Comment ─────────────────────────────────────────────────────────────────

type Comment struct {
	ID              uuid.UUID
	ThreadID        uuid.UUID
	ParentCommentID *uuid.UUID
	AuthorID        uuid.UUID
	Body            CommentBody
	BodyText        string
	CreatedAt       time.Time
	UpdatedAt       time.Time
	EditedAt        *time.Time
	DeletedAt       *time.Time
	Status          string
}

// ─── Mention ─────────────────────────────────────────────────────────────────

type Mention struct {
	ID              uuid.UUID
	CommentID       uuid.UUID
	MentionedUserID uuid.UUID
	CreatedAt       time.Time
}

// ─── ThreadSubscription ───────────────────────────────────────────────────────

type ThreadSubscription struct {
	ThreadID    uuid.UUID
	UserID      uuid.UUID
	IsFollowing bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// ─── ThreadParticipant ────────────────────────────────────────────────────────

type ThreadParticipant struct {
	ThreadID  uuid.UUID
	UserID    uuid.UUID
	Role      string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// ─── Requests ────────────────────────────────────────────────────────────────

type CreateThreadRequest struct {
	Anchor Anchor
	Body   CommentBody
}

type CreateReplyRequest struct {
	Body CommentBody
}
