package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Open creates and pings a pgxpool connection pool.
func Open(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	db, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("create db pool: %w", err)
	}
	if err := db.Ping(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}
	return db, nil
}

// WithTx runs fn inside a transaction on pool, rolling back on error.
func WithTx(ctx context.Context, db *pgxpool.Pool, fn func(pgx.Tx) error) error {
	tx, err := db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)
	if err := fn(tx); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}

// DB is a thin wrapper around pgxpool.Pool that exposes commonly used
// methods and adds a WithTx helper that passes context into the callback.
type DB struct {
	Pool *pgxpool.Pool
}

// New opens a pool and returns a DB wrapper.
func New(ctx context.Context, dsn string) (*DB, error) {
	pool, err := Open(ctx, dsn)
	if err != nil {
		return nil, err
	}
	return &DB{Pool: pool}, nil
}

func (d *DB) Close() { d.Pool.Close() }

// WithTx runs fn inside a transaction, passing both ctx and the transaction.
func (d *DB) WithTx(ctx context.Context, fn func(context.Context, pgx.Tx) error) error {
	tx, err := d.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)
	if err := fn(ctx, tx); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}

func (d *DB) QueryRow(ctx context.Context, q string, args ...any) pgx.Row {
	return d.Pool.QueryRow(ctx, q, args...)
}

func (d *DB) Exec(ctx context.Context, q string, args ...any) (pgconn.CommandTag, error) {
	return d.Pool.Exec(ctx, q, args...)
}
