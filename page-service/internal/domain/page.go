package domain

import (
	"time"

	"github.com/google/uuid"
)

type Page struct {
	ID      uuid.UUID
	Title   string
	OwnerID uuid.UUID
	Size    int64
	Version int64

	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt *time.Time
}
