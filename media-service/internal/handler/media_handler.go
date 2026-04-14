package handler

import (
	"context"
	"time"

	mediav1 "github.com/flow-note/api-contracts/generated/proto/media/v1"
	"github.com/flow-note/common/authctx"
	"github.com/flow-note/media-service/internal/usecase"
	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type mediaHandler struct {
	mediav1.UnimplementedMediaServiceServer

	logger          *zap.Logger
	snapshotUsecase usecase.SnapshotService
	mediaUsecase    usecase.MediaService
}

func NewMediaHandler(logger *zap.Logger, snapshotUsecase usecase.SnapshotService, mediaUsecase usecase.MediaService) *mediaHandler {
	return &mediaHandler{
		logger:          logger,
		snapshotUsecase: snapshotUsecase,
		mediaUsecase:    mediaUsecase,
	}
}

func (h *mediaHandler) GetLatestSnapshotDownloadUrl(
	ctx context.Context,
	req *mediav1.GetLatestSnapshotDownloadUrlRequest,
) (*mediav1.GetLatestSnapshotDownloadUrlResponse, error) {
	startedAt := time.Now()
	if err := req.ValidateAll(); err != nil {
		h.logWarn("GetLatestSnapshotDownloadUrl", startedAt, err,
			zap.String("page_id", req.GetPageId()),
		)

		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	cred, err := authctx.ParseUserIDAndPermissionRole(ctx)
	if err != nil {
		h.logWarn("GetLatestSnapshotDownloadUrl", startedAt, err)
		return nil, err
	}

	result, err := h.snapshotUsecase.GetLatestSnapshotDownloadURL(ctx, cred, mustParseUUID(req.GetPageId()))
	if err != nil {
		return nil, h.mapError(err)
	}

	resp := &mediav1.GetLatestSnapshotDownloadUrlResponse{
		DownloadUrl: result.URL,
		ExpiresAt:   result.ExpiresAt,
	}

	return resp, nil
}

func (h *mediaHandler) GetSnapshotDownloadUrl(
	ctx context.Context,
	req *mediav1.GetSnapshotDownloadUrlRequest,
) (*mediav1.GetSnapshotDownloadUrlResponse, error) {
	startedAt := time.Now()

	if err := req.ValidateAll(); err != nil {
		h.logWarn("GetSnapshotDownloadUrl", startedAt, err,
			zap.String("page_id", req.GetPageId()),
			zap.String("version_id", req.GetVersionId()),
		)

		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	cred, err := authctx.ParseUserIDAndPermissionRole(ctx)
	if err != nil {
		h.logWarn("GetSnapshotDownloadUrl", startedAt, err)
		return nil, err
	}

	result, err := h.snapshotUsecase.GetSnapshotDownloadURL(ctx, cred, mustParseUUID(req.GetPageId()), req.GetVersionId())
	if err != nil {
		return nil, h.mapError(err)
	}

	resp := &mediav1.GetSnapshotDownloadUrlResponse{
		DownloadUrl: result.URL,
		ExpiresAt:   result.ExpiresAt,
	}

	return resp, nil
}

func (h *mediaHandler) GetMediaDownloadUrl(
	ctx context.Context,
	req *mediav1.GetMediaDownloadUrlRequest,
) (*mediav1.GetMediaDownloadUrlResponse, error) {
	startedAt := time.Now()

	if err := req.ValidateAll(); err != nil {
		h.logWarn("GetMediaDownloadUrl", startedAt, err,
			zap.String("page_id", req.GetPageId()),
			zap.String("media_id", req.GetMediaId()),
		)

		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	cred, err := authctx.ParseUserIDAndPermissionRole(ctx)
	if err != nil {
		h.logWarn("GetMediaDownloadUrl", startedAt, err)
		return nil, err
	}

	result, err := h.mediaUsecase.GetMediaDownloadURL(ctx, cred, mustParseUUID(req.GetPageId()), mustParseUUID(req.GetMediaId()))
	if err != nil {
		return nil, h.mapError(err)
	}

	resp := &mediav1.GetMediaDownloadUrlResponse{
		DownloadUrl: result.URL,
		ExpiresAt:   result.ExpiresAt,
	}

	return resp, nil
}

func (h *mediaHandler) GetMediaUploadUrl(
	ctx context.Context,
	req *mediav1.GetMediaUploadUrlRequest,
) (*mediav1.GetMediaUploadUrlResponse, error) {
	startedAt := time.Now()

	if err := req.ValidateAll(); err != nil {
		h.logWarn("GetMediaUploadUrl", startedAt, err,
			zap.String("page_id", req.GetPageId()),
		)

		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	cred, err := authctx.ParseUserIDAndPermissionRole(ctx)
	if err != nil {
		h.logWarn("GetMediaUploadUrl", startedAt, err)
		return nil, err
	}

	result, err := h.mediaUsecase.GetMediaUploadURL(ctx, cred, mustParseUUID(req.GetPageId()))
	if err != nil {
		return nil, h.mapError(err)
	}

	resp := &mediav1.GetMediaUploadUrlResponse{
		UploadUrl: result.URL,
		MediaId:   result.MediaID.String(),
		ExpiresAt: result.ExpiresAt,
	}

	return resp, nil
}
