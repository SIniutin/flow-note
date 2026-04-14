package domain

import "github.com/google/uuid"

type Table struct {
	ID      uuid.UUID
	PageId  uuid.UUID
	DstId   uuid.UUID
	BlockId uuid.UUID
}

type PageTableInput struct {
	DstID   string
	BlockID uuid.UUID
}
