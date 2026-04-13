package clients

import (
	"context"

	"github.com/google/uuid"
)

type PageAccessClient interface {
	HasAccess(ctx context.Context, pageID, userID uuid.UUID) (bool, error)
	GetPageOwner(ctx context.Context, pageID uuid.UUID) (uuid.UUID, error)
	GetPageWatchers(ctx context.Context, pageID uuid.UUID) ([]uuid.UUID, error)
	GetPageTitle(ctx context.Context, pageID uuid.UUID) (string, error)
}

type UserClient interface {
	ResolveMentionCandidates(ctx context.Context, pageID uuid.UUID, query string) ([]uuid.UUID, error)
}

type StubPageAccessClient struct{}

func (StubPageAccessClient) HasAccess(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return true, nil
}

func (StubPageAccessClient) GetPageOwner(context.Context, uuid.UUID) (uuid.UUID, error) {
	return uuid.Nil, nil
}

func (StubPageAccessClient) GetPageWatchers(context.Context, uuid.UUID) ([]uuid.UUID, error) {
	return nil, nil
}

func (StubPageAccessClient) GetPageTitle(context.Context, uuid.UUID) (string, error) {
	return "Untitled", nil
}

type GRPCPageAccessClient struct{}

func (GRPCPageAccessClient) HasAccess(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return true, nil
}

func (GRPCPageAccessClient) GetPageOwner(context.Context, uuid.UUID) (uuid.UUID, error) {
	return uuid.Nil, nil
}

func (GRPCPageAccessClient) GetPageWatchers(context.Context, uuid.UUID) ([]uuid.UUID, error) {
	return nil, nil
}

func (GRPCPageAccessClient) GetPageTitle(context.Context, uuid.UUID) (string, error) {
	return "Untitled", nil
}
