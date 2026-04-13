package domain

import (
	"context"
	"errors"
)

var ErrRepoIsFull = errors.New("repository is full")

type UserRepo interface {
	Create(ctx context.Context, u User, password PasswordHash) (User, error)
	GetByEmail(ctx context.Context, email Email) (User, error)
	GetByLogin(ctx context.Context, login Login) (User, error)
	GetCredentials(ctx context.Context, id UserID) (Credentials, error)
}

type SessionRepo interface {
	CreateRefresh(ctx context.Context, s RefreshSession) error
	GetRefresh(ctx context.Context, tokenHash []byte) (RefreshSession, error)
	RevokeRefresh(ctx context.Context, tokenHash []byte) error
}
