package usecase

import (
	"context"

	d "github.com/flow-note/auth-service/internal/domain"
)

type GetUserByName struct {
	u d.UserRepo
}

func NewGetUserByName(u d.UserRepo) *GetUserByName {
	return &GetUserByName{u: u}
}

func (c *GetUserByName) Exec(ctx context.Context, login d.Login) (d.User, error) {
	if err := ctx.Err(); err != nil {
		return d.User{}, err
	}
	return c.u.GetByLogin(ctx, login)
}
