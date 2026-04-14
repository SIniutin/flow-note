package service

import (
	"context"
	"testing"
	"time"

	"github.com/flow-note/comment-service/internal/domain"
	"github.com/flow-note/common/apperrors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type fakeTxManager struct{}

func (fakeTxManager) WithTx(ctx context.Context, fn func(ctx context.Context, tx pgx.Tx) error) error {
	return fn(ctx, nil)
}

type fakeComments struct {
	items map[uuid.UUID]domain.Comment
}

func newFakeComments() *fakeComments {
	return &fakeComments{items: make(map[uuid.UUID]domain.Comment)}
}

func (f *fakeComments) CreateComment(_ context.Context, _ pgx.Tx, comment domain.Comment) error {
	f.items[comment.ID] = comment
	return nil
}

func (f *fakeComments) GetComment(_ context.Context, query domain.GetCommentQuery) (domain.Comment, error) {
	return f.items[query.CommentID], nil
}

func (f *fakeComments) ListComments(_ context.Context, query domain.ListCommentsQuery) ([]domain.Comment, error) {
	out := make([]domain.Comment, 0)
	for _, item := range f.items {
		if item.PageID != query.PageID {
			continue
		}
		if !query.IncludeDeleted && item.Deleted {
			continue
		}
		if query.ParentCommentID == nil && item.ParentID != nil {
			continue
		}
		if query.ParentCommentID != nil {
			if item.ParentID == nil || *item.ParentID != *query.ParentCommentID {
				continue
			}
		}
		out = append(out, item)
	}
	return out, nil
}

func (f *fakeComments) SoftDeleteComment(_ context.Context, _ pgx.Tx, comment domain.Comment, _ time.Time) error {
	f.items[comment.ID] = comment
	return nil
}

type fakeSubscriptions struct {
	items map[string]domain.CommentSubscription
}

func newFakeSubscriptions() *fakeSubscriptions {
	return &fakeSubscriptions{items: make(map[string]domain.CommentSubscription)}
}

func (f *fakeSubscriptions) UpsertSubscription(_ context.Context, _ pgx.Tx, subscription domain.CommentSubscription) error {
	f.items[subscription.UserID.String()+":"+subscription.PageID.String()] = subscription
	return nil
}

func (f *fakeSubscriptions) GetSubscription(_ context.Context, userID, pageID string) (domain.CommentSubscription, error) {
	item, ok := f.items[userID+":"+pageID]
	if !ok {
		return domain.CommentSubscription{}, apperrors.ErrNotFound
	}
	return item, nil
}

func TestMakeCommentStoresComment(t *testing.T) {
	repo := newFakeComments()
	subs := newFakeSubscriptions()
	svc := New(fakeTxManager{}, repo, subs)

	comment, err := svc.MakeComment(context.Background(), domain.CreateCommentCommand{
		UserID: uuid.New(),
		PageID: uuid.New(),
		Body:   "hello",
	})
	if err != nil {
		t.Fatal(err)
	}

	stored, ok := repo.items[comment.ID]
	if !ok {
		t.Fatal("expected comment to be stored")
	}
	if stored.Body != "hello" {
		t.Fatalf("expected body hello, got %q", stored.Body)
	}
}

func TestMakeCommentRejectsCrossPageParent(t *testing.T) {
	repo := newFakeComments()
	subs := newFakeSubscriptions()
	svc := New(fakeTxManager{}, repo, subs)

	parent := domain.Comment{
		ID:        uuid.New(),
		UserID:    uuid.New(),
		PageID:    uuid.New(),
		Body:      "root",
		Status:    domain.CommentStatusActive,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	repo.items[parent.ID] = parent

	_, err := svc.MakeComment(context.Background(), domain.CreateCommentCommand{
		UserID:   uuid.New(),
		PageID:   uuid.New(),
		ParentID: &parent.ID,
		Body:     "reply",
	})
	if err == nil {
		t.Fatal("expected error for cross-page parent")
	}
}

func TestDeleteCommentSoftDeletesOwnedComment(t *testing.T) {
	repo := newFakeComments()
	subs := newFakeSubscriptions()
	svc := New(fakeTxManager{}, repo, subs)

	actorID := uuid.New()
	comment := domain.Comment{
		ID:        uuid.New(),
		UserID:    actorID,
		PageID:    uuid.New(),
		Body:      "hello",
		Status:    domain.CommentStatusActive,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	repo.items[comment.ID] = comment

	if err := svc.DeleteComment(context.Background(), actorID, comment.ID); err != nil {
		t.Fatal(err)
	}

	if !repo.items[comment.ID].Deleted {
		t.Fatal("expected comment to be soft-deleted")
	}
}

func TestSubscribeAndUnsubscribePersistState(t *testing.T) {
	repo := newFakeComments()
	subs := newFakeSubscriptions()
	svc := New(fakeTxManager{}, repo, subs)

	userID := uuid.New()
	pageID := uuid.New()

	if err := svc.SubscribeToComments(context.Background(), domain.SubscribeToCommentsCommand{
		UserID: userID,
		PageID: pageID,
	}); err != nil {
		t.Fatal(err)
	}

	item := subs.items[userID.String()+":"+pageID.String()]
	if item.Status != domain.SubscriptionStatusActive {
		t.Fatalf("expected active subscription, got %s", item.Status)
	}

	if err := svc.UnsubscribeFromComments(context.Background(), domain.UnsubscribeFromCommentsCommand{
		UserID: userID,
		PageID: pageID,
	}); err != nil {
		t.Fatal(err)
	}

	item = subs.items[userID.String()+":"+pageID.String()]
	if item.Status != domain.SubscriptionStatusInactive {
		t.Fatalf("expected inactive subscription, got %s", item.Status)
	}
}
