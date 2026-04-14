package perm

func permissionLevel(role PermissionRole) int {
	switch role {
	case "viewer":
		return 1
	case "commenter":
		return 2
	case "editor":
		return 3
	case "mentor":
		return 4
	case "owner":
		return 5
	default:
		return 0
	}
}

func HasRequiredPermission(actualRole, requiredRole PermissionRole) bool {
	return permissionLevel(actualRole) >= permissionLevel(requiredRole)
}
