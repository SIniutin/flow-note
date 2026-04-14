package domain

import (
	"time"

	"github.com/google/uuid"
)

type Version struct {
	Id     int64
	PageId uuid.UUID
	Size   int64
	Date   string

	CreatedAt time.Time
}
