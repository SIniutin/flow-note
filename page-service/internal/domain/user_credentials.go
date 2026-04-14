package domain

import "github.com/google/uuid"

type UserCredentials struct {
	UserId uuid.UUID
	Role   PermissionRole
}
