package domain

import "github.com/google/uuid"

type MediaType string

const (
	VIDEO MediaType = "VIDEO"
	FILE  MediaType = "FILE"
	AUDIO MediaType = "AUDIO"
	IMAGE MediaType = "IMAGE"
)

type Media struct {
	ID      uuid.UUID
	PageID  uuid.UUID
	Size    int64
	Type    MediaType
	BlockId uuid.UUID
}

type PageMediaInput struct {
	MediaID uuid.UUID
	Type    MediaType
	BlockID uuid.UUID
}
