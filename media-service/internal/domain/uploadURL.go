package domain

import (
	"github.com/google/uuid"
)

type UploadURL struct {
	MediaID   uuid.UUID
	URL       string
	ExpiresAt int64
}
