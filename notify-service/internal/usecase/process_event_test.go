package usecase

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/flow-note/common/events"
	"github.com/flow-note/notify-service/internal/domain"
	"github.com/flow-note/notify-service/internal/domain/port"
	"github.com/google/uuid"
)

// ── fakes ─────────────────────────────────────────────────────────────────────

type fakeRepo struct {
	items      []domain.Notification
	saveResult func(context.Context, domain.ProcessedEvent, []domain.Notification) (bool, error)
}

func (f *fakeRepo) SaveEventNotifications(ctx context.Context, event domain.ProcessedEvent, items []domain.Notification) (bool, error) {
	if f.saveResult != nil {
		return f.saveResult(ctx, event, items)
	}
	f.items = append(f.items, items...)
	return true, nil
}

func (f *fakeRepo) ListByUser(_ context.Context, _ uuid.UUID, _ port.ListFilter) ([]domain.Notification, error) {
	return f.items, nil
}

func (f *fakeRepo) MarkRead(_ context.Context, _, _ uuid.UUID, _ time.Time) error { return nil }

func (f *fakeRepo) MarkAllRead(_ context.Context, _ uuid.UUID, _ time.Time) error { return nil }

type publishedEvent struct {
	channel string
	payload any
}

type fakePublisher struct {
	items []publishedEvent
}

func (f *fakePublisher) PublishUser(_ context.Context, channel string, payload any) error {
	f.items = append(f.items, publishedEvent{channel: channel, payload: payload})
	return nil
}

// ── helpers ───────────────────────────────────────────────────────────────────

func newUC(repo *fakeRepo, pub *fakePublisher) *ProcessEvent {
	return NewProcessEvent(repo, pub)
}

// ── tests ─────────────────────────────────────────────────────────────────────

func TestProcessEventIdempotent(t *testing.T) {
	repo := &fakeRepo{}
	pub := &fakePublisher{}
	calls := 0
	repo.saveResult = func(_ context.Context, _ domain.ProcessedEvent, items []domain.Notification) (bool, error) {
		calls++
		if calls == 1 {
			repo.items = append(repo.items, items...)
			return true, nil
		}
		return false, nil
	}

	uc := newUC(repo, pub)
	pageID, threadID, commentID, eventID, actor := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	envelope := events.Envelope{
		EventID:        eventID,
		EventType:      events.EventCommentCreated,
		OccurredAt:     time.Now(),
		ActorUserID:    &actor,
		PageID:         &pageID,
		ThreadID:       &threadID,
		CommentID:      &commentID,
		RecipientsHint: []uuid.UUID{uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"), uuid.MustParse("cccccccc-cccc-cccc-cccc-cccccccccccc"), uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")},
		Preview:        "hello",
	}

	if err := uc.Execute(context.Background(), envelope); err != nil {
		t.Fatal(err)
	}
	if err := uc.Execute(context.Background(), envelope); err != nil {
		t.Fatal(err)
	}
	if len(repo.items) != 3 {
		t.Fatalf("expected 3 notifications, got %d", len(repo.items))
	}
	if len(pub.items) != 3 {
		t.Fatalf("expected 3 realtime messages, got %d", len(pub.items))
	}
}

func TestDedupeKeyPerRecipient(t *testing.T) {
	repo := &fakeRepo{}
	uc := newUC(repo, &fakePublisher{})

	pageID, threadID, mentioned := uuid.New(), uuid.New(), uuid.New()
	envelope := events.Envelope{
		EventID:         uuid.New(),
		EventType:       events.EventCommentMentionCreated,
		PageID:          &pageID,
		ThreadID:        &threadID,
		MentionedUserID: &mentioned,
		DedupeKey:       "mention:1",
	}

	items, err := uc.route(context.Background(), envelope)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(items))
	}
	if items[0].DedupeKey == nil || *items[0].DedupeKey != "mention:1:"+mentioned.String() {
		raw, _ := json.Marshal(items[0])
		t.Fatalf("unexpected dedupe key: %s", raw)
	}
}

func TestProcessPageMentionPublishesRealtime(t *testing.T) {
	repo := &fakeRepo{}
	pub := &fakePublisher{}
	uc := newUC(repo, pub)

	pageID, threadID, commentID, mentioned, actor := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	err := uc.Execute(context.Background(), events.Envelope{
		EventID:         uuid.New(),
		EventType:       events.EventPageMentionCreated,
		OccurredAt:      time.Now(),
		ActorUserID:     &actor,
		PageID:          &pageID,
		ThreadID:        &threadID,
		CommentID:       &commentID,
		MentionedUserID: &mentioned,
		Preview:         "page mention",
		DedupeKey:       "page-mention-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.items) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(repo.items))
	}
	if repo.items[0].Type != domain.NotificationMentionPage {
		t.Fatalf("expected type %s, got %s", domain.NotificationMentionPage, repo.items[0].Type)
	}
	if len(pub.items) != 1 {
		t.Fatalf("expected 1 realtime event, got %d", len(pub.items))
	}
	if pub.items[0].channel != "notifications:"+mentioned.String() {
		t.Fatalf("unexpected channel %s", pub.items[0].channel)
	}
}

func TestProcessCommentMentionPublishesRealtime(t *testing.T) {
	repo := &fakeRepo{}
	pub := &fakePublisher{}
	uc := newUC(repo, pub)

	pageID, threadID, commentID, mentioned, actor := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	err := uc.Execute(context.Background(), events.Envelope{
		EventID:         uuid.New(),
		EventType:       events.EventCommentMentionCreated,
		OccurredAt:      time.Now(),
		ActorUserID:     &actor,
		PageID:          &pageID,
		ThreadID:        &threadID,
		CommentID:       &commentID,
		MentionedUserID: &mentioned,
		Preview:         "comment mention",
		DedupeKey:       "comment-mention-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.items) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(repo.items))
	}
	if repo.items[0].Type != domain.NotificationMentionComment {
		t.Fatalf("expected type %s, got %s", domain.NotificationMentionComment, repo.items[0].Type)
	}
	if len(pub.items) != 1 {
		t.Fatalf("expected 1 realtime event, got %d", len(pub.items))
	}
	if pub.items[0].channel != "notifications:"+mentioned.String() {
		t.Fatalf("unexpected channel %s", pub.items[0].channel)
	}
}
