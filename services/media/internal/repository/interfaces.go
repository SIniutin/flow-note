package repository

import (
	"context"

	"github.com/flow-note/media-service/internal/domain"
	"github.com/google/uuid"
)

type SnapshotRepository interface {
	GetLatestSnapshotDownloadURL(ctx context.Context, pageID uuid.UUID) (*domain.DownloadURL, error)
	GetSnapshotDownloadURL(ctx context.Context, pageID uuid.UUID, versionID string) (*domain.DownloadURL, error)
}

type MediaRepository interface {
	GetMediaDownloadURL(ctx context.Context, pageID uuid.UUID, mediaID uuid.UUID) (*domain.DownloadURL, error)
	GetMediaUploadURL(ctx context.Context, pageID uuid.UUID) (*domain.UploadURL, error)
}
