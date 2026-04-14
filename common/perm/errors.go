package perm

import "errors"

var (
	ErrPermissionDenied         = errors.New("permission denied")
	ErrOwnerPermissionRequired  = errors.New("owner permission required")
	ErrMentorPermissionRequired = errors.New("mentor permission required")
	ErrEditorPermissionRequired = errors.New("editor permission required")
	ErrViewerPermissionRequired = errors.New("viewer permission required")
)
