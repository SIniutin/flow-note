package domain

import (
	"time"

	"github.com/google/uuid"
)

const (
	NotificationMentionComment = "mention.comment"
	NotificationMentionPage    = "mention.page"
	NotificationCommentNew     = "comment.new"
	NotificationCommentReply   = "comment.reply"
)

type NotificationType string

const (
	NOTIFICATION_TYPE_UNSPECIFIED     NotificationType = "unspecified"
	NOTIFICATION_TYPE_MENTION_COMMENT NotificationType = "comment_mention"
	NOTIFICATION_TYPE_MENTION_PAGE    NotificationType = "page_mention"
	NOTIFICATION_TYPE_COMMENT_THREAD  NotificationType = "comment_thread"
	NOTIFICATION_TYPE_COMMENT_REPLY   NotificationType = "comment_reply"
	NOTIFICATION_TYPE_COMMENT_MENTION NotificationType = "comment_mention"
)

type Notification struct {
	ID          uuid.UUID
	UserID      uuid.UUID
	Type        NotificationType
	ActorUserID *uuid.UUID
	PageID      *uuid.UUID
	CommentID   *uuid.UUID
	ReadAt      *time.Time
	CancelledAt *time.Time
	CreatedAt   time.Time
}
