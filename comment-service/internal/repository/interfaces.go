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

type ThreadRepository interface {
	CreateThread(ctx context.Context, tx pgx.Tx, thread domain.Thread) error
	UpdateThreadStatus(ctx context.Context, tx pgx.Tx, threadID uuid.UUID, status string, actor uuid.UUID, at time.Time) error
	IncrementComments(ctx context.Context, tx pgx.Tx, threadID uuid.UUID, at time.Time) error
	GetThread(ctx context.Context, threadID uuid.UUID) (domain.Thread, error)
	ListThreadsByPage(ctx context.Context, pageID uuid.UUID, activeOnly bool, limit, offset int) ([]domain.Thread, error)
}

type CommentRepository interface {
	CreateComment(ctx context.Context, tx pgx.Tx, comment domain.Comment) error
	GetComment(ctx context.Context, commentID uuid.UUID) (domain.Comment, error)
	ListCommentsByThread(ctx context.Context, threadID uuid.UUID) ([]domain.Comment, error)
	SoftDelete(ctx context.Context, tx pgx.Tx, commentID uuid.UUID, at time.Time) error
}

type MentionRepository interface {
	CreateMentions(ctx context.Context, tx pgx.Tx, mentions []domain.Mention) error
}

type SubscriptionRepository interface {
	UpsertFollowing(ctx context.Context, tx pgx.Tx, sub domain.ThreadSubscription) error
	IsFollowing(ctx context.Context, threadID, userID uuid.UUID) (bool, error)
	ListFollowers(ctx context.Context, threadID uuid.UUID) ([]uuid.UUID, error)
}

type ParticipantRepository interface {
	UpsertParticipant(ctx context.Context, tx pgx.Tx, participant domain.ThreadParticipant) error
	ListParticipants(ctx context.Context, threadID uuid.UUID) ([]domain.ThreadParticipant, error)
}
