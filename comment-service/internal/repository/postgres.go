package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/flow-note/comment-service/internal/domain"
	"github.com/flow-note/common/apperrors"
	commonpg "github.com/flow-note/common/runtime/postgres"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Postgres struct {
	db *commonpg.DB
}

func NewPostgres(db *commonpg.DB) *Postgres {
	return &Postgres{db: db}
}

func (p *Postgres) CreateThread(ctx context.Context, tx pgx.Tx, thread domain.Thread) error {
	anchor, err := json.Marshal(thread.Anchor)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO comment_threads
		    (id, page_id, anchor, anchor_hash, created_by, status, created_at, updated_at, last_commented_at, comments_count)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
	`, thread.ID, thread.PageID, anchor, thread.AnchorHash, thread.CreatedBy, thread.Status, thread.CreatedAt, thread.UpdatedAt, thread.LastCommentedAt, thread.CommentsCount)
	return err
}

func (p *Postgres) UpdateThreadStatus(ctx context.Context, tx pgx.Tx, threadID uuid.UUID, status string, actor uuid.UUID, at time.Time) error {
	tag, err := tx.Exec(ctx, `
		UPDATE comment_threads
		SET status=$2, updated_at=$3, resolved_by=CASE WHEN $2='resolved' THEN $4 ELSE NULL END,
		    resolved_at=CASE WHEN $2='resolved' THEN $3 ELSE NULL END
		WHERE id=$1
	`, threadID, status, at, actor)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperrors.ErrNotFound
	}
	return nil
}

func (p *Postgres) IncrementComments(ctx context.Context, tx pgx.Tx, threadID uuid.UUID, at time.Time) error {
	_, err := tx.Exec(ctx, `
		UPDATE comment_threads
		SET comments_count = comments_count + 1, last_commented_at=$2, updated_at=$2
		WHERE id=$1
	`, threadID, at)
	return err
}

func (p *Postgres) GetThread(ctx context.Context, threadID uuid.UUID) (domain.Thread, error) {
	row := p.db.QueryRow(ctx, `
		SELECT id, page_id, anchor, COALESCE(anchor_hash,''), created_by, status, created_at, updated_at,
		       resolved_by, resolved_at, last_commented_at, comments_count
		FROM comment_threads
		WHERE id=$1
	`, threadID)
	return scanThread(row)
}

func (p *Postgres) ListThreadsByPage(ctx context.Context, pageID uuid.UUID, activeOnly bool, limit, offset int) ([]domain.Thread, error) {
	query := `
		SELECT id, page_id, anchor, COALESCE(anchor_hash,''), created_by, status, created_at, updated_at,
		       resolved_by, resolved_at, last_commented_at, comments_count
		FROM comment_threads
		WHERE page_id=$1`
	args := []any{pageID}
	if activeOnly {
		query += ` AND status='active'`
	}
	query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	args = append(args, limit, offset)
	rows, err := p.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []domain.Thread
	for rows.Next() {
		thread, err := scanThread(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, thread)
	}
	return items, rows.Err()
}

func (p *Postgres) CreateComment(ctx context.Context, tx pgx.Tx, comment domain.Comment) error {
	body, err := json.Marshal(comment.Body)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO comments
		    (id, thread_id, parent_comment_id, author_id, body, body_text, created_at, updated_at, edited_at, deleted_at, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
	`, comment.ID, comment.ThreadID, comment.ParentCommentID, comment.AuthorID, body, comment.BodyText, comment.CreatedAt, comment.UpdatedAt, comment.EditedAt, comment.DeletedAt, comment.Status)
	return err
}

func (p *Postgres) GetComment(ctx context.Context, commentID uuid.UUID) (domain.Comment, error) {
	row := p.db.QueryRow(ctx, `
		SELECT id, thread_id, parent_comment_id, author_id, body, COALESCE(body_text,''), created_at, updated_at, edited_at, deleted_at, status
		FROM comments WHERE id=$1
	`, commentID)
	return scanComment(row)
}

func (p *Postgres) ListCommentsByThread(ctx context.Context, threadID uuid.UUID) ([]domain.Comment, error) {
	rows, err := p.db.Query(ctx, `
		SELECT id, thread_id, parent_comment_id, author_id, body, COALESCE(body_text,''), created_at, updated_at, edited_at, deleted_at, status
		FROM comments
		WHERE thread_id=$1
		ORDER BY created_at ASC
	`, threadID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []domain.Comment
	for rows.Next() {
		comment, err := scanComment(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, comment)
	}
	return items, rows.Err()
}

func (p *Postgres) SoftDelete(ctx context.Context, tx pgx.Tx, commentID uuid.UUID, at time.Time) error {
	tag, err := tx.Exec(ctx, `
		UPDATE comments
		SET status='deleted', deleted_at=$2, updated_at=$2, body='[]'::jsonb, body_text='[deleted]'
		WHERE id=$1 AND deleted_at IS NULL
	`, commentID, at)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperrors.ErrNotFound
	}
	return nil
}

func (p *Postgres) CreateMentions(ctx context.Context, tx pgx.Tx, mentions []domain.Mention) error {
	for _, item := range mentions {
		_, err := tx.Exec(ctx, `
			INSERT INTO comment_mentions (id, comment_id, mentioned_user_id, created_at)
			VALUES ($1,$2,$3,$4)
			ON CONFLICT (comment_id, mentioned_user_id) DO NOTHING
		`, item.ID, item.CommentID, item.MentionedUserID, item.CreatedAt)
		if err != nil {
			return err
		}
	}
	return nil
}

func (p *Postgres) UpsertFollowing(ctx context.Context, tx pgx.Tx, sub domain.ThreadSubscription) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO thread_subscriptions (thread_id, user_id, is_following, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT (thread_id, user_id)
		DO UPDATE SET is_following=EXCLUDED.is_following, updated_at=EXCLUDED.updated_at
	`, sub.ThreadID, sub.UserID, sub.IsFollowing, sub.CreatedAt, sub.UpdatedAt)
	return err
}

func (p *Postgres) IsFollowing(ctx context.Context, threadID, userID uuid.UUID) (bool, error) {
	row := p.db.QueryRow(ctx, `
		SELECT is_following FROM thread_subscriptions WHERE thread_id=$1 AND user_id=$2
	`, threadID, userID)
	var following bool
	if err := row.Scan(&following); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return following, nil
}

func (p *Postgres) ListFollowers(ctx context.Context, threadID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := p.db.Query(ctx, `
		SELECT user_id FROM thread_subscriptions WHERE thread_id=$1 AND is_following=TRUE
	`, threadID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []uuid.UUID
	for rows.Next() {
		var userID uuid.UUID
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		items = append(items, userID)
	}
	return items, rows.Err()
}

func (p *Postgres) UpsertParticipant(ctx context.Context, tx pgx.Tx, participant domain.ThreadParticipant) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO thread_participants (thread_id, user_id, role, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT (thread_id, user_id, role)
		DO UPDATE SET updated_at=EXCLUDED.updated_at
	`, participant.ThreadID, participant.UserID, participant.Role, participant.CreatedAt, participant.UpdatedAt)
	return err
}

func (p *Postgres) ListParticipants(ctx context.Context, threadID uuid.UUID) ([]domain.ThreadParticipant, error) {
	rows, err := p.db.Query(ctx, `
		SELECT thread_id, user_id, role, created_at, updated_at
		FROM thread_participants
		WHERE thread_id=$1
	`, threadID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []domain.ThreadParticipant
	for rows.Next() {
		var item domain.ThreadParticipant
		if err := rows.Scan(&item.ThreadID, &item.UserID, &item.Role, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

type scanner interface {
	Scan(dest ...any) error
}

func scanThread(row scanner) (domain.Thread, error) {
	var item domain.Thread
	var anchorBytes []byte
	err := row.Scan(&item.ID, &item.PageID, &anchorBytes, &item.AnchorHash, &item.CreatedBy, &item.Status, &item.CreatedAt, &item.UpdatedAt,
		&item.ResolvedBy, &item.ResolvedAt, &item.LastCommentedAt, &item.CommentsCount)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Thread{}, apperrors.ErrNotFound
		}
		return domain.Thread{}, err
	}
	if err := json.Unmarshal(anchorBytes, &item.Anchor); err != nil {
		return domain.Thread{}, fmt.Errorf("unmarshal anchor: %w", err)
	}
	return item, nil
}

func scanComment(row scanner) (domain.Comment, error) {
	var item domain.Comment
	var bodyBytes []byte
	err := row.Scan(&item.ID, &item.ThreadID, &item.ParentCommentID, &item.AuthorID, &bodyBytes, &item.BodyText, &item.CreatedAt, &item.UpdatedAt, &item.EditedAt, &item.DeletedAt, &item.Status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Comment{}, apperrors.ErrNotFound
		}
		return domain.Comment{}, err
	}
	if err := json.Unmarshal(bodyBytes, &item.Body); err != nil {
		return domain.Comment{}, err
	}
	return item, nil
}
