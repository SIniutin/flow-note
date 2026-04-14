package usecase

import (
	"context"

	"github.com/flow-note/common/authctx"
	"github.com/flow-note/media-service/internal/domain"
	"github.com/flow-note/media-service/internal/repository"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

var (
	_ MediaService    = (*mediaService)(nil)
	_ SnapshotService = (*mediaService)(nil)
)

type (
	SnapshotService interface {
		GetLatestSnapshotDownloadURL(ctx context.Context, userCredentials *authctx.UserCredentials, pageID uuid.UUID) (*domain.DownloadURL, error)
		GetSnapshotDownloadURL(ctx context.Context, userCredentials *authctx.UserCredentials, pageID uuid.UUID, versionID string) (*domain.DownloadURL, error)
	}

	MediaService interface {
		GetMediaDownloadURL(ctx context.Context, userCredentials *authctx.UserCredentials, pageID uuid.UUID, mediaID uuid.UUID) (*domain.DownloadURL, error)
		GetMediaUploadURL(ctx context.Context, userCredentials *authctx.UserCredentials, pageID uuid.UUID) (*domain.UploadURL, error)
	}
)

type mediaService struct {
	logger       *zap.Logger
	mediaRepo    repository.MediaRepository
	snapshotRepo repository.SnapshotRepository
}

func NewMediaService(logger *zap.Logger, mediaRepo repository.MediaRepository, snapshotRepo repository.SnapshotRepository) *mediaService {
	return &mediaService{
		logger:       logger,
		mediaRepo:    mediaRepo,
		snapshotRepo: snapshotRepo,
	}
}
