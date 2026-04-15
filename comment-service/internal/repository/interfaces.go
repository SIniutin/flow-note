package repository

import (
	"context"
	"time"

	"github.com/flow-note/comment-service/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type TxManager interface {
	WithTx(ctx context.Context, fn func(ctx context.Context, tx pgx.Tx) error) error
}

type PgxTx = pgx.Tx

type CommentRepository interface {
	CreateComment(ctx context.Context, tx pgx.Tx, comment domain.Comment) error
	GetComment(ctx context.Context, query domain.GetCommentQuery) (domain.Comment, error)
	GetRootCommentByPageIDAndBodyID(ctx context.Context, pageID uuid.UUID, bodyID string) (domain.Comment, error)
	ListComments(ctx context.Context, query domain.ListCommentsQuery) ([]domain.Comment, error)
	SoftDeleteComment(ctx context.Context, tx pgx.Tx, comment domain.Comment, at time.Time) error
}

type SubscriptionRepository interface {
	UpsertSubscription(ctx context.Context, tx pgx.Tx, subscription domain.CommentSubscription) error
	GetSubscription(ctx context.Context, userID, pageID string) (domain.CommentSubscription, error)
	ListActiveSubscriptionsByPage(ctx context.Context, pageID string) ([]domain.CommentSubscription, error)
}
