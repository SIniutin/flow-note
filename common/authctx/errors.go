package authctx

import "errors"

var (
	ErrMissingUserIDInContext   = errors.New("missing user id in context")
	ErrInvalidUserIDInContext   = errors.New("invalid user id in context")
	ErrMissingUserRoleInContext = errors.New("missing user role id in context")
	ErrInvalidUserRoleInContext = errors.New("invalid user role id in context")
)
