package perm

type PermissionRole string

const (
	RoleViewer      PermissionRole = "viewer"
	RoleCommenter   PermissionRole = "commenter"
	RoleEditor      PermissionRole = "editor"
	RoleMentor      PermissionRole = "mentor"
	RoleOwner       PermissionRole = "owner"
	RoleUnspecified PermissionRole = "unspecified"
)
