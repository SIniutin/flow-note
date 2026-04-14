package handler

import (
	"errors"

	"github.com/flow-note/media-service/internal/domain"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func (h *mediaHandler) mapError(err error) error {
	switch {
	case errors.Is(err, domain.ErrLatestSnapshotNotFound),
		errors.Is(err, domain.ErrSnapshotNotFound),
		errors.Is(err, domain.ErrMediaNotFound):
		return status.Error(codes.NotFound, err.Error())
	case errors.Is(err, domain.ErrInvalidPageID),
		errors.Is(err, domain.ErrInvalidMediaID),
		errors.Is(err, domain.ErrInvalidVersionID):
		return status.Error(codes.InvalidArgument, err.Error())
	default:
		return status.Error(codes.Internal, "internal server error")
	}
}
