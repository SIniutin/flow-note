package domain

import (
	"github.com/google/uuid"
)

type PageLink struct {
	ID         uuid.UUID
	FromPageID uuid.UUID
	ToPageID   uuid.UUID
	BlockID    uuid.UUID
}

type PageLinkInput struct {
	ToPageID uuid.UUID
	BlockID  uuid.UUID
}
