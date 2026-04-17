package domain

import "errors"

var (
	ErrLatestSnapshotNotFound = errors.New("latest snapshot not found")
	ErrSnapshotNotFound       = errors.New("snapshot not found")
	ErrMediaNotFound          = errors.New("media not found")

	ErrInvalidPageID    = errors.New("invalid page id")
	ErrInvalidMediaID   = errors.New("invalid media id")
	ErrInvalidVersionID = errors.New("invalid version id")

	ErrEmptyObjectKey = errors.New("empty object key")
	ErrPresignFailed  = errors.New("failed to generate presigned url")
)
