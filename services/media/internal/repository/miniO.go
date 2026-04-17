package repository

import (
	"context"
	"fmt"
	"net/url"
	"path"
	"time"

	"github.com/flow-note/media-service/internal/domain"
	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
)

type minioRepository struct {
	client         *minio.Client
	bucketName     string
	uploadUrlTTL   time.Duration
	downloadUrlTTL time.Duration
	latestSnapKey  string
}

var (
	_ SnapshotRepository = (*minioRepository)(nil)
	_ MediaRepository    = (*minioRepository)(nil)
)

func NewMinioRepository(
	client *minio.Client,
	bucketName string,
	uploadUrlTTL time.Duration,
	downloadUrlTTL time.Duration,
) *minioRepository {
	return &minioRepository{
		client:         client,
		bucketName:     bucketName,
		uploadUrlTTL:   uploadUrlTTL,
		downloadUrlTTL: downloadUrlTTL,
		// TODO: to config
		latestSnapKey: "latest.bin",
	}
}

func (r *minioRepository) GetLatestSnapshotDownloadURL(
	ctx context.Context,
	pageID uuid.UUID,
) (*domain.DownloadURL, error) {
	objectKey := r.latestSnapshotObjectKey(pageID)

	return r.presignDownloadURL(ctx, objectKey, domain.ErrLatestSnapshotNotFound)
}

func (r *minioRepository) GetSnapshotDownloadURL(
	ctx context.Context,
	pageID uuid.UUID,
	versionID string,
) (*domain.DownloadURL, error) {
	objectKey := r.snapshotObjectKey(pageID, versionID)

	return r.presignDownloadURL(ctx, objectKey, domain.ErrSnapshotNotFound)
}

func (r *minioRepository) GetMediaDownloadURL(
	ctx context.Context,
	pageID uuid.UUID,
	mediaID uuid.UUID,
) (*domain.DownloadURL, error) {
	objectKey := r.mediaObjectKey(pageID, mediaID)

	return r.presignDownloadURL(ctx, objectKey, domain.ErrMediaNotFound)
}

func (r *minioRepository) GetMediaUploadURL(
	ctx context.Context,
	pageID uuid.UUID,
) (*domain.UploadURL, error) {
	mediaID := uuid.New()
	objectKey := r.mediaObjectKey(pageID, mediaID)

	presignedURL, err := r.client.PresignedPutObject(ctx, r.bucketName, objectKey, r.uploadUrlTTL)
	if err != nil {
		return nil, fmt.Errorf("presign put object %q: %w", objectKey, domain.ErrPresignFailed)
	}

	return &domain.UploadURL{
		MediaID:   mediaID,
		URL:       presignedURL.String(),
		ExpiresAt: time.Now().Add(r.uploadUrlTTL).Unix(),
	}, nil
}

func (r *minioRepository) presignDownloadURL(
	ctx context.Context,
	objectKey string,
	notFoundErr error,
) (*domain.DownloadURL, error) {
	if objectKey == "" {
		return nil, domain.ErrEmptyObjectKey
	}

	_, err := r.client.StatObject(ctx, r.bucketName, objectKey, minio.StatObjectOptions{})
	if err != nil {
		if minio.ToErrorResponse(err).Code == "NoSuchKey" {
			return nil, notFoundErr
		}

		return nil, fmt.Errorf("stat object %q: %w", objectKey, domain.ErrPresignFailed)
	}

	presignedURL, err := r.client.PresignedGetObject(
		ctx,
		r.bucketName,
		objectKey,
		r.downloadUrlTTL,
		url.Values{},
	)
	if err != nil {
		return nil, fmt.Errorf("presign get object %q: %w", objectKey, domain.ErrPresignFailed)
	}

	return &domain.DownloadURL{
		URL:       presignedURL.String(),
		ExpiresAt: time.Now().Add(r.downloadUrlTTL).Unix(),
	}, nil
}

func (r *minioRepository) latestSnapshotObjectKey(pageID uuid.UUID) string {
	return path.Join("snapshots", pageID.String(), r.latestSnapKey)
}

func (r *minioRepository) snapshotObjectKey(pageID uuid.UUID, versionID string) string {
	return path.Join("snapshots", pageID.String(), versionID)
}

func (r *minioRepository) mediaObjectKey(pageID uuid.UUID, mediaID uuid.UUID) string {
	return path.Join("media", pageID.String(), mediaID.String())
}
