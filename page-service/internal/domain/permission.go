package domain

import (
	"time"

	"github.com/google/uuid"
)

type PermissionRole string

const (
	RoleViewer    PermissionRole = "viewer"
	RoleCommenter PermissionRole = "commenter"
	RoleEditor    PermissionRole = "editor"
	RoleMentor    PermissionRole = "mentor"
	RoleOwner     PermissionRole = "owner"
)

type Permission struct {
	ID        uuid.UUID
	PageID    uuid.UUID
	UserID    uuid.UUID
	Role      PermissionRole
	GrantedBy uuid.UUID

	CreatedAt time.Time
	UpdatedAt time.Time
}
