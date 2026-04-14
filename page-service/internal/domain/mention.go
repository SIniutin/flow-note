package domain

import (
	"github.com/google/uuid"
)

type Mention struct {
	ID      uuid.UUID
	PageID  uuid.UUID
	UserID  uuid.UUID
	BlockID uuid.UUID
}

type PageMentionInput struct {
	UserID  uuid.UUID
	BlockID uuid.UUID
}
