package clients

import (
	"context"

	"github.com/google/uuid"
)

// PageAccessClient checks page permissions and retrieves page-level recipients.
type PageAccessClient interface {
	HasAccess(ctx context.Context, pageID, userID uuid.UUID) (bool, error)
	GetPageOwner(ctx context.Context, pageID uuid.UUID) (uuid.UUID, error)
	GetPageWatchers(ctx context.Context, pageID uuid.UUID) ([]uuid.UUID, error)
}

// StubPageAccessClient allows all access and returns empty recipients.
// TODO: replace with a real gRPC client once the pages service exposes these RPCs.
type StubPageAccessClient struct{}

func (StubPageAccessClient) HasAccess(_ context.Context, _, _ uuid.UUID) (bool, error) {
	return true, nil
}

func (StubPageAccessClient) GetPageOwner(_ context.Context, _ uuid.UUID) (uuid.UUID, error) {
	return uuid.Nil, nil
}

func (StubPageAccessClient) GetPageWatchers(_ context.Context, _ uuid.UUID) ([]uuid.UUID, error) {
	return nil, nil
}
