package repository

import (
	"context"
	"time"

	"github.com/flow-note/common/apperrors"
	commonpg "github.com/flow-note/common/postgres"
	"github.com/flow-note/notify-service/internal/domain"
	"github.com/google/uuid"
)

type Postgres struct {
	db *commonpg.DB
}

func NewPostgres(db *commonpg.DB) *Postgres {
	return &Postgres{db: db}
}

func (p *Postgres) SaveEventNotifications(ctx context.Context, event domain.ProcessedEvent, items []domain.Notification) (bool, error) {
	tx, err := p.db.Pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		INSERT INTO processed_events (event_id, event_type, processed_at)
		VALUES ($1,$2,$3)
		ON CONFLICT (event_id) DO NOTHING
	`, event.EventID, event.EventType, event.ProcessedAt)
	if err != nil {
		return false, err
	}
	if tag.RowsAffected() == 0 {
		return false, tx.Commit(ctx)
	}

	for _, item := range items {
		_, err := tx.Exec(ctx, `
			INSERT INTO notifications (id, user_id, type, actor_user_id, page_id, thread_id, comment_id, payload, dedupe_key, created_at, read_at, cancelled_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
			ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
		`, item.ID, item.UserID, item.Type, item.ActorUserID, item.PageID, item.ThreadID, item.CommentID, item.Payload, item.DedupeKey, item.CreatedAt, item.ReadAt, item.CancelledAt)
		if err != nil {
			return false, err
		}
	}

	return true, tx.Commit(ctx)
}

func (p *Postgres) ListByUser(ctx context.Context, userID uuid.UUID, unreadOnly bool, onlyMentions bool, limit, offset int) ([]domain.Notification, error) {
	query := `
		SELECT id, user_id, type, actor_user_id, page_id, thread_id, comment_id, payload, dedupe_key, created_at, read_at, cancelled_at
		FROM notifications
		WHERE user_id=$1 AND cancelled_at IS NULL`
	args := []any{userID}
	if unreadOnly {
		query += ` AND read_at IS NULL`
	}
	if onlyMentions {
		query += ` AND type IN ('mention.page', 'mention.comment')`
	}
	query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	args = append(args, limit, offset)
	rows, err := p.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []domain.Notification
	for rows.Next() {
		var item domain.Notification
		if err := rows.Scan(&item.ID, &item.UserID, &item.Type, &item.ActorUserID, &item.PageID, &item.ThreadID, &item.CommentID, &item.Payload, &item.DedupeKey, &item.CreatedAt, &item.ReadAt, &item.CancelledAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (p *Postgres) MarkRead(ctx context.Context, userID, notificationID uuid.UUID, at time.Time) error {
	tag, err := p.db.Exec(ctx, `
		UPDATE notifications SET read_at=$3 WHERE id=$1 AND user_id=$2
	`, notificationID, userID, at)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperrors.ErrNotFound
	}
	return nil
}

func (p *Postgres) MarkAllRead(ctx context.Context, userID uuid.UUID, at time.Time) error {
	_, err := p.db.Exec(ctx, `
		UPDATE notifications SET read_at=$2 WHERE user_id=$1 AND read_at IS NULL
	`, userID, at)
	return err
}
