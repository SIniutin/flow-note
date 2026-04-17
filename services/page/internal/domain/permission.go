package domain

import (
	"time"

	"github.com/flow-note/common/perm"
	"github.com/google/uuid"
)

type Permission struct {
	ID        uuid.UUID
	PageID    uuid.UUID
	UserID    uuid.UUID
	Role      perm.PermissionRole
	GrantedBy uuid.UUID

	CreatedAt time.Time
	UpdatedAt time.Time
}
