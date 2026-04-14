package postgre

import (
	"context"
	"errors"
	"fmt"

	d "github.com/flow-note/auth-service/internal/domain"
	"github.com/flow-note/common/postgres"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type userRepoImpl struct {
	db *postgres.DB
}

func NewPostgreRepo(db *postgres.DB) *userRepoImpl {
	return &userRepoImpl{db: db}
}

func (r *userRepoImpl) Create(ctx context.Context, u d.User, password d.PasswordHash) (d.User, error) {
	const q1 = `
		INSERT INTO users (id, email, login)
		VALUES ($1, $2, $3)
		RETURNING id, email, login
	`
	const q2 = `
		INSERT INTO credentials (user_id, password_algo, password_hash)
		VALUES ($1, $2, $3)
	`

	var nU d.User
	err := r.db.WithTx(ctx, func(ctx context.Context, tx pgx.Tx) error {
		var (
			id       uuid.UUID
			rawEmail string
			rawLogin string
		)
		err := tx.QueryRow(
			ctx,
			q1,
			uuid.UUID(u.ID),
			string(u.Email),
			string(u.Login),
		).Scan(
			&id,
			&rawEmail,
			&rawLogin,
		)
		if err != nil {
			return mapPGError(err)
		}
		nU.ID = d.UserID(id)
		nU.Email = d.Email(rawEmail)
		nU.Login = d.Login(rawLogin)

		_, err = tx.Exec(
			ctx,
			q2,
			uuid.UUID(nU.ID),
			password.Algo,
			password.Hash,
		)
		if err != nil {
			return mapPGError(err)
		}

		return nil
	})
	if err != nil {
		return d.User{}, err
	}

	return nU, nil
}

func (r *userRepoImpl) GetByEmail(ctx context.Context, email d.Email) (d.User, error) {
	const q = `
		SELECT id, email, login
		FROM users
		WHERE lower(email) = lower($1)
	`

	var (
		u        d.User
		id       uuid.UUID
		rawEmail string
		rawLogin string
	)
	err := r.db.QueryRow(ctx, q, string(email)).Scan(&id, &rawEmail, &rawLogin)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return d.User{}, d.ErrNotFound
		}
		return d.User{}, fmt.Errorf("get user by email: %w", err)
	}

	u.ID = d.UserID(id)
	u.Email = d.Email(rawEmail)
	u.Login = d.Login(rawLogin)
	return u, nil
}

func (r *userRepoImpl) GetByLogin(ctx context.Context, login d.Login) (d.User, error) {
	const q = `
		SELECT id, email, login
		FROM users
		WHERE lower(login) = lower($1)
	`

	var (
		u        d.User
		id       uuid.UUID
		rawEmail string
		rawLogin string
	)
	err := r.db.QueryRow(ctx, q, string(login)).Scan(&id, &rawEmail, &rawLogin)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return d.User{}, d.ErrNotFound
		}
		return d.User{}, fmt.Errorf("get user by login: %w", err)
	}

	u.ID = d.UserID(id)
	u.Email = d.Email(rawEmail)
	u.Login = d.Login(rawLogin)
	return u, nil
}

func (r *userRepoImpl) GetCredentials(ctx context.Context, id d.UserID) (d.Credentials, error) {
	const q = `
		SELECT user_id, password_algo, password_hash
		FROM credentials
		WHERE user_id = $1
	`

	var c d.Credentials
	err := r.db.QueryRow(ctx, q, uuid.UUID(id)).Scan(
		(*uuid.UUID)(&c.UserID),
		&c.PasswordHash.Algo,
		&c.PasswordHash.Hash,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return d.Credentials{}, d.ErrNotFound
		}
		return d.Credentials{}, fmt.Errorf("get credentials: %w", err)
	}

	return c, nil
}

func mapPGError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			return d.ErrConflict
		case "23514", "23502":
			return d.ErrValidation
		}
	}

	return err
}
