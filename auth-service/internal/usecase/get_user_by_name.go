package usecase

import (
	"context"

	d "github.com/flow-note/auth-service/internal/domain"
)

type GetUserById struct {
	u d.UserRepo
}

func NewGetUserById(u d.UserRepo) *GetUserById {
	return &GetUserById{u: u}
}

func (c *GetUserById) Exec(ctx context.Context, id d.UserID) (d.User, error) {
	if err := ctx.Err(); err != nil {
		return d.User{}, err
	}
	return c.u.GetByID(ctx, id)
}
