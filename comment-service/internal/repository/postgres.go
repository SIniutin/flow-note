package repository

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/flow-note/comment-service/internal/domain"
	"github.com/flow-note/common/apperrors"
	commonpg "github.com/flow-note/common/postgres"
	"github.com/jackc/pgx/v5"
)

type Postgres struct {
	db *commonpg.DB
}

func NewPostgres(db *commonpg.DB) *Postgres {
	return &Postgres{db: db}
}

func (p *Postgres) CreateComment(ctx context.Context, tx pgx.Tx, comment domain.Comment) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO comments
		    (id, user_id, parent_id, page_id, body_id, body, status, deleted, created_at, updated_at, deleted_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
	`, comment.ID, comment.UserID, comment.ParentID, comment.PageID, comment.BodyID, comment.Body, comment.Status, comment.Deleted, comment.CreatedAt, comment.UpdatedAt, comment.DeletedAt)
	return err
}

func (p *Postgres) GetComment(ctx context.Context, query domain.GetCommentQuery) (domain.Comment, error) {
	if err := query.Validate(); err != nil {
		return domain.Comment{}, err
	}

	row := p.db.QueryRow(ctx, `
		SELECT id, user_id, parent_id, page_id, body_id, body, status, deleted, created_at, updated_at, deleted_at
		FROM comments
		WHERE id = $1
	`, query.CommentID)

	return scanComment(row)
}

func (p *Postgres) ListComments(ctx context.Context, query domain.ListCommentsQuery) ([]domain.Comment, error) {
	if err := query.Validate(); err != nil {
		return nil, err
	}

	sql := `
		SELECT id, user_id, parent_id, page_id, body_id, body, status, deleted, created_at, updated_at, deleted_at
		FROM comments
		WHERE page_id = $1`
	args := []any{query.PageID}

	if !query.IncludeDeleted {
		sql += ` AND deleted = FALSE`
	}

	if query.ParentCommentID != nil {
		sql += ` AND parent_id = $2`
		args = append(args, *query.ParentCommentID)
	} else {
		sql += ` AND parent_id IS NULL`
	}

	sql += ` ORDER BY created_at ASC`

	if query.Limit > 0 {
		sql += ` LIMIT $` + limitArgPosition(args)
		args = append(args, query.Limit)
	}
	if query.Offset > 0 {
		sql += ` OFFSET $` + limitArgPosition(args)
		args = append(args, query.Offset)
	}

	rows, err := p.db.Pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]domain.Comment, 0)
	for rows.Next() {
		item, err := scanComment(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func (p *Postgres) SoftDeleteComment(ctx context.Context, tx pgx.Tx, comment domain.Comment, at time.Time) error {
	tag, err := tx.Exec(ctx, `
		UPDATE comments
		SET status = 'deleted',
		    deleted = TRUE,
		    body = '',
		    updated_at = $2,
		    deleted_at = $2
		WHERE id = $1 AND deleted_at IS NULL
	`, comment.ID, at)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperrors.ErrNotFound
	}
	return nil
}

func (p *Postgres) UpsertSubscription(ctx context.Context, tx pgx.Tx, subscription domain.CommentSubscription) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO comment_subscriptions
		    (id, user_id, page_id, status, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (user_id, page_id)
		DO UPDATE SET
		    status = EXCLUDED.status,
		    updated_at = EXCLUDED.updated_at
	`, subscription.ID, subscription.UserID, subscription.PageID, subscription.Status, subscription.CreatedAt, subscription.UpdatedAt)
	return err
}

func (p *Postgres) GetSubscription(ctx context.Context, userID, pageID string) (domain.CommentSubscription, error) {
	row := p.db.QueryRow(ctx, `
		SELECT id, user_id, page_id, status, created_at, updated_at
		FROM comment_subscriptions
		WHERE user_id = $1 AND page_id = $2
	`, userID, pageID)
	return scanSubscription(row)
}

type scanner interface {
	Scan(dest ...any) error
}

func scanComment(row scanner) (domain.Comment, error) {
	var item domain.Comment
	err := row.Scan(
		&item.ID,
		&item.UserID,
		&item.ParentID,
		&item.PageID,
		&item.BodyID,
		&item.Body,
		&item.Status,
		&item.Deleted,
		&item.CreatedAt,
		&item.UpdatedAt,
		&item.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Comment{}, apperrors.ErrNotFound
		}
		return domain.Comment{}, err
	}
	return item, nil
}

func scanSubscription(row scanner) (domain.CommentSubscription, error) {
	var item domain.CommentSubscription
	err := row.Scan(
		&item.ID,
		&item.UserID,
		&item.PageID,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.CommentSubscription{}, apperrors.ErrNotFound
		}
		return domain.CommentSubscription{}, err
	}
	return item, nil
}

func limitArgPosition(args []any) string {
	return strconv.Itoa(len(args) + 1)
}
