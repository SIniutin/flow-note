package service

import (
	"context"
	"testing"
	"time"

	"github.com/flow-note/comment-service/internal/domain"
	"github.com/flow-note/common/apperrors"
	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/broker"
	"github.com/flow-note/common/perm"
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

func (f *fakeSubscriptions) ListActiveSubscriptionsByPage(_ context.Context, pageID string) ([]domain.CommentSubscription, error) {
	out := make([]domain.CommentSubscription, 0)
	for _, item := range f.items {
		if item.PageID.String() == pageID && item.Status == domain.SubscriptionStatusActive {
			out = append(out, item)
		}
	}
	return out, nil
}

type fakePublisher struct {
	items []broker.Event
}

func (f *fakePublisher) Publish(_ context.Context, event broker.Event) error {
	f.items = append(f.items, event)
	return nil
}

func TestMakeCommentStoresComment(t *testing.T) {
	repo := newFakeComments()
	subs := newFakeSubscriptions()
	pub := &fakePublisher{}
	svc := New(fakeTxManager{}, repo, subs, pub)

	actorID := uuid.New()
	pageID := uuid.New()
	watcherID := uuid.New()
	subs.items[watcherID.String()+":"+pageID.String()] = domain.CommentSubscription{
		ID:        uuid.New(),
		UserID:    watcherID,
		PageID:    pageID,
		Status:    domain.SubscriptionStatusActive,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}

	comment, err := svc.MakeComment(context.Background(), &authctx.UserCredentials{
		UserId: actorID,
		Role:   perm.RoleCommenter,
	}, domain.CreateCommentCommand{
		UserID: actorID,
		PageID: pageID,
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
	if len(pub.items) != 1 {
		t.Fatalf("expected 1 published event, got %d", len(pub.items))
	}
	if pub.items[0].Type != broker.EventCommentThread {
		t.Fatalf("expected event type %q, got %q", broker.EventCommentThread, pub.items[0].Type)
	}
	if pub.items[0].UserID != watcherID.String() {
		t.Fatalf("expected recipient %s, got %s", watcherID, pub.items[0].UserID)
	}
}

func TestMakeCommentRejectsCrossPageParent(t *testing.T) {
	repo := newFakeComments()
	subs := newFakeSubscriptions()
	svc := New(fakeTxManager{}, repo, subs, nil)

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

	_, err := svc.MakeComment(context.Background(), &authctx.UserCredentials{
		UserId: uuid.New(),
		Role:   perm.RoleCommenter,
	}, domain.CreateCommentCommand{
		UserID:   uuid.New(),
		PageID:   uuid.New(),
		ParentID: &parent.ID,
		Body:     "reply",
	})
	if err == nil {
		t.Fatal("expected error for cross-page parent")
	}
}

func TestReplyPublishesEventToParentAuthor(t *testing.T) {
	repo := newFakeComments()
	subs := newFakeSubscriptions()
	pub := &fakePublisher{}
	svc := New(fakeTxManager{}, repo, subs, pub)

	parentAuthor := uuid.New()
	pageID := uuid.New()
	parent := domain.Comment{
		ID:        uuid.New(),
		UserID:    parentAuthor,
		PageID:    pageID,
		Body:      "root",
		Status:    domain.CommentStatusActive,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	repo.items[parent.ID] = parent

	replyAuthor := uuid.New()
	_, err := svc.MakeComment(context.Background(), &authctx.UserCredentials{
		UserId: replyAuthor,
		Role:   perm.RoleCommenter,
	}, domain.CreateCommentCommand{
		UserID:   replyAuthor,
		PageID:   pageID,
		ParentID: &parent.ID,
		Body:     "reply",
	})
	if err != nil {
		t.Fatal(err)
	}

	if len(pub.items) != 1 {
		t.Fatalf("expected 1 published event, got %d", len(pub.items))
	}
	if pub.items[0].Type != broker.EventCommentReply {
		t.Fatalf("expected event type %q, got %q", broker.EventCommentReply, pub.items[0].Type)
	}
	if pub.items[0].UserID != parentAuthor.String() {
		t.Fatalf("expected recipient %s, got %s", parentAuthor, pub.items[0].UserID)
	}
}

func TestDeleteCommentSoftDeletesOwnedComment(t *testing.T) {
	repo := newFakeComments()
	subs := newFakeSubscriptions()
	svc := New(fakeTxManager{}, repo, subs, nil)

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

	if err := svc.DeleteComment(context.Background(), &authctx.UserCredentials{
		UserId: actorID,
		Role:   perm.RoleCommenter,
	}, actorID, comment.ID); err != nil {
		t.Fatal(err)
	}

	if !repo.items[comment.ID].Deleted {
		t.Fatal("expected comment to be soft-deleted")
	}
}

func TestSubscribeAndUnsubscribePersistState(t *testing.T) {
	repo := newFakeComments()
	subs := newFakeSubscriptions()
	svc := New(fakeTxManager{}, repo, subs, nil)

	userID := uuid.New()
	pageID := uuid.New()

	if err := svc.SubscribeToComments(context.Background(), &authctx.UserCredentials{
		UserId: userID,
		Role:   perm.RoleViewer,
	}, domain.SubscribeToCommentsCommand{
		UserID: userID,
		PageID: pageID,
	}); err != nil {
		t.Fatal(err)
	}

	item := subs.items[userID.String()+":"+pageID.String()]
	if item.Status != domain.SubscriptionStatusActive {
		t.Fatalf("expected active subscription, got %s", item.Status)
	}

	if err := svc.UnsubscribeFromComments(context.Background(), &authctx.UserCredentials{
		UserId: userID,
		Role:   perm.RoleViewer,
	}, domain.UnsubscribeFromCommentsCommand{
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
