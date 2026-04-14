package domain

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	ErrInvalidCommentID      = errors.New("invalid comment id")
	ErrInvalidUserID         = errors.New("invalid user id")
	ErrInvalidPageID         = errors.New("invalid page id")
	ErrInvalidBodyID         = errors.New("invalid body id")
	ErrEmptyCommentBody      = errors.New("comment body is empty")
	ErrCommentAlreadyDeleted = errors.New("comment already deleted")
)

type CommentStatus string

const (
	CommentStatusActive  CommentStatus = "active"
	CommentStatusDeleted CommentStatus = "deleted"
)

type SubscriptionStatus string

const (
	SubscriptionStatusActive   SubscriptionStatus = "active"
	SubscriptionStatusInactive SubscriptionStatus = "inactive"
)

type Comment struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	ParentID  *uuid.UUID
	PageID    uuid.UUID
	BodyID    *uuid.UUID
	Body      string
	Status    CommentStatus
	Deleted   bool
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt *time.Time
}

func NewComment(now time.Time, cmd CreateCommentCommand) (Comment, error) {
	if err := cmd.Validate(); err != nil {
		return Comment{}, err
	}

	createdAt := now.UTC()
	comment := Comment{
		ID:        uuid.New(),
		UserID:    cmd.UserID,
		PageID:    cmd.PageID,
		Body:      normalizeBody(cmd.Body),
		Status:    CommentStatusActive,
		Deleted:   false,
		CreatedAt: createdAt,
		UpdatedAt: createdAt,
	}

	if cmd.ParentID != nil {
		parentID := *cmd.ParentID
		comment.ParentID = &parentID
	}
	if cmd.BodyID != nil {
		bodyID := *cmd.BodyID
		comment.BodyID = &bodyID
	}

	return comment, nil
}

func (c Comment) Validate() error {
	switch {
	case c.ID == uuid.Nil:
		return ErrInvalidCommentID
	case c.UserID == uuid.Nil:
		return ErrInvalidUserID
	case c.PageID == uuid.Nil:
		return ErrInvalidPageID
	case strings.TrimSpace(c.Body) == "":
		return ErrEmptyCommentBody
	}

	if c.BodyID != nil && *c.BodyID == uuid.Nil {
		return ErrInvalidBodyID
	}
	if c.ParentID != nil && *c.ParentID == uuid.Nil {
		return ErrInvalidCommentID
	}

	return nil
}

func (c Comment) IsRoot() bool {
	return c.ParentID == nil
}

func (c Comment) CanBeEditedBy(userID uuid.UUID) bool {
	return !c.Deleted && c.UserID == userID
}

func (c Comment) CanBeDeletedBy(userID uuid.UUID) bool {
	return !c.Deleted && c.UserID == userID
}

func (c *Comment) UpdateBody(body string, now time.Time) error {
	if c.Deleted {
		return ErrCommentAlreadyDeleted
	}

	normalized := normalizeBody(body)
	if normalized == "" {
		return ErrEmptyCommentBody
	}

	c.Body = normalized
	c.UpdatedAt = now.UTC()
	return nil
}

func (c *Comment) SoftDelete(now time.Time) error {
	if c.Deleted {
		return ErrCommentAlreadyDeleted
	}

	deletedAt := now.UTC()
	c.Deleted = true
	c.Status = CommentStatusDeleted
	c.DeletedAt = &deletedAt
	c.UpdatedAt = deletedAt
	c.Body = ""
	return nil
}

type CommentSubscription struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	PageID    uuid.UUID
	Status    SubscriptionStatus
	CreatedAt time.Time
	UpdatedAt time.Time
}

func NewCommentSubscription(now time.Time, cmd SubscribeToCommentsCommand) (CommentSubscription, error) {
	if err := cmd.Validate(); err != nil {
		return CommentSubscription{}, err
	}

	ts := now.UTC()
	return CommentSubscription{
		ID:        uuid.New(),
		UserID:    cmd.UserID,
		PageID:    cmd.PageID,
		Status:    SubscriptionStatusActive,
		CreatedAt: ts,
		UpdatedAt: ts,
	}, nil
}

func (s *CommentSubscription) Activate(now time.Time) {
	s.Status = SubscriptionStatusActive
	s.UpdatedAt = now.UTC()
}

func (s *CommentSubscription) Deactivate(now time.Time) {
	s.Status = SubscriptionStatusInactive
	s.UpdatedAt = now.UTC()
}

type CreateCommentCommand struct {
	UserID   uuid.UUID
	ParentID *uuid.UUID
	PageID   uuid.UUID
	BodyID   *uuid.UUID
	Body     string
}

func (c CreateCommentCommand) Validate() error {
	switch {
	case c.UserID == uuid.Nil:
		return ErrInvalidUserID
	case c.PageID == uuid.Nil:
		return ErrInvalidPageID
	case normalizeBody(c.Body) == "":
		return ErrEmptyCommentBody
	}

	if c.ParentID != nil && *c.ParentID == uuid.Nil {
		return ErrInvalidCommentID
	}
	if c.BodyID != nil && *c.BodyID == uuid.Nil {
		return ErrInvalidBodyID
	}

	return nil
}

type GetCommentQuery struct {
	CommentID uuid.UUID
}

func (q GetCommentQuery) Validate() error {
	if q.CommentID == uuid.Nil {
		return ErrInvalidCommentID
	}
	return nil
}

type ListCommentsQuery struct {
	PageID          uuid.UUID
	IncludeDeleted  bool
	ParentCommentID *uuid.UUID
	Limit           int
	Offset          int
}

func (q ListCommentsQuery) Validate() error {
	if q.PageID == uuid.Nil {
		return ErrInvalidPageID
	}
	if q.ParentCommentID != nil && *q.ParentCommentID == uuid.Nil {
		return ErrInvalidCommentID
	}
	if q.Limit < 0 || q.Offset < 0 {
		return errors.New("negative pagination is not allowed")
	}
	return nil
}

type SubscribeToCommentsCommand struct {
	UserID uuid.UUID
	PageID uuid.UUID
}

func (c SubscribeToCommentsCommand) Validate() error {
	if c.UserID == uuid.Nil {
		return ErrInvalidUserID
	}
	if c.PageID == uuid.Nil {
		return ErrInvalidPageID
	}
	return nil
}

type UnsubscribeFromCommentsCommand struct {
	UserID uuid.UUID
	PageID uuid.UUID
}

func (c UnsubscribeFromCommentsCommand) Validate() error {
	if c.UserID == uuid.Nil {
		return ErrInvalidUserID
	}
	if c.PageID == uuid.Nil {
		return ErrInvalidPageID
	}
	return nil
}

func normalizeBody(body string) string {
	return strings.TrimSpace(body)
}
