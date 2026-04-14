package domain

import "errors"

var (
	ErrPageNotFound       = errors.New("page not found")
	ErrVersionNotFound    = errors.New("version not found")
	ErrPermissionNotFound = errors.New("permission not found")
	ErrLinkNotFound       = errors.New("link not found")
	ErrMentionNotFound    = errors.New("mention not found")
	ErrTableNotFound      = errors.New("table not found")
	ErrMediaNotFound      = errors.New("media not found")

	ErrPageAlreadyExists       = errors.New("page already exists")
	ErrPermissionAlreadyExists = errors.New("permission already exists")

	ErrInvalidPageTitle         = errors.New("invalid page title")
	ErrInvalidPageSize          = errors.New("invalid page size")
	ErrInvalidVersionID         = errors.New("invalid version id")
	ErrInvalidPermissionRole    = errors.New("invalid permission role")
	ErrInvalidBlockID           = errors.New("invalid block id")
	ErrInvalidMediaType         = errors.New("invalid media type")
	ErrInvalidPaginationLimit   = errors.New("invalid pagination limit")
	ErrInvalidPaginationOffset  = errors.New("invalid pagination offset")
	ErrInvalidTableDstID        = errors.New("invalid table dst id")
	ErrMissingUserIDInContext   = errors.New("missing user id in context")
	ErrInvalidUserIDInContext   = errors.New("invalid user id in context")
	ErrMissingUserRoleInContext = errors.New("missing user role id in context")
	ErrInvalidUserRoleInContext = errors.New("invalid user role id in context")

	ErrPermissionDenied         = errors.New("permission denied")
	ErrOwnerPermissionRequired  = errors.New("owner permission required")
	ErrMentorPermissionRequired = errors.New("mentor permission required")
	ErrEditorPermissionRequired = errors.New("editor permission required")
	ErrViewerPermissionRequired = errors.New("viewer permission required")

	ErrRollbackVersionNotFound = errors.New("rollback version not found")
	ErrCurrentVersionNotFound  = errors.New("current version not found")
	ErrLastVersionNotFound     = errors.New("last version not found")

	ErrEmptyLinks    = errors.New("empty links")
	ErrEmptyMentions = errors.New("empty mentions")
	ErrEmptyTables   = errors.New("empty tables")
	ErrEmptyMedia    = errors.New("empty media")
)
