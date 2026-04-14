package mem

import (
	"context"
	"sync"

	d "github.com/flow-note/auth-service/internal/domain"
	"github.com/google/uuid"
)

type userRepoImpl struct {
	mu sync.RWMutex

	userByID map[d.UserID]d.User
	credById map[d.UserID]d.Credentials

	idByEmail map[string]d.UserID
	idByLogin map[string]d.UserID
}

func NewUserRepo() *userRepoImpl {
	return &userRepoImpl{
		userByID:  make(map[d.UserID]d.User),
		credById:  make(map[d.UserID]d.Credentials),
		idByEmail: make(map[string]d.UserID),
		idByLogin: make(map[string]d.UserID),
	}
}

func (r *userRepoImpl) Create(ctx context.Context, u d.User, password d.PasswordHash) (d.User, error) {
	if err := ctx.Err(); err != nil {
		return d.User{}, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	if u.ID.String() == uuid.Nil.String() || u.Email == "" || u.Login == "" {
		return d.User{}, d.ErrValidation
	}

	emailKey := string(u.Email)
	loginKey := string(u.Login)

	if _, ok := r.idByEmail[emailKey]; ok {
		return d.User{}, d.ErrConflict
	}
	if _, ok := r.idByLogin[loginKey]; ok {
		return d.User{}, d.ErrConflict
	}
	nCred := d.Credentials{
		UserID:       u.ID,
		PasswordHash: password,
	}

	r.userByID[u.ID] = u
	r.credById[u.ID] = nCred
	r.idByEmail[emailKey] = u.ID
	r.idByLogin[loginKey] = u.ID

	return u, nil
}

func (r *userRepoImpl) GetByID(ctx context.Context, id d.UserID) (d.User, error) {
	if err := ctx.Err(); err != nil {
		return d.User{}, err
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	u, ok := r.userByID[id]
	if !ok {
		return d.User{}, d.ErrNotFound
	}
	return u, nil
}

func (r *userRepoImpl) GetByEmail(ctx context.Context, email d.Email) (d.User, error) {
	if err := ctx.Err(); err != nil {
		return d.User{}, err
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	id, ok := r.idByEmail[string(email)]
	if !ok {
		return d.User{}, d.ErrNotFound
	}
	u, ok := r.userByID[id]
	if !ok {
		return d.User{}, d.ErrNotFound
	}
	return u, nil
}

func (r *userRepoImpl) GetByLogin(ctx context.Context, login d.Login) (d.User, error) {
	if err := ctx.Err(); err != nil {
		return d.User{}, err
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	id, ok := r.idByLogin[string(login)]
	if !ok {
		return d.User{}, d.ErrNotFound
	}
	u, ok := r.userByID[id]
	if !ok {
		return d.User{}, d.ErrNotFound
	}
	return u, nil
}

func (r *userRepoImpl) GetCredentials(ctx context.Context, id d.UserID) (d.Credentials, error) {
	if err := ctx.Err(); err != nil {
		return d.Credentials{}, err
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	cred, ok := r.credById[id]
	if !ok {
		return d.Credentials{}, d.ErrNotFound
	}
	return cred, nil
}
