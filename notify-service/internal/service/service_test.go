package service

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/flow-note/common/events"
	"github.com/flow-note/notify-service/internal/domain"
	"github.com/google/uuid"
)

type fakeNotifications struct {
	items      []domain.Notification
	saveResult func(context.Context, domain.ProcessedEvent, []domain.Notification) (bool, error)
}

func (f *fakeNotifications) SaveEventNotifications(ctx context.Context, event domain.ProcessedEvent, items []domain.Notification) (bool, error) {
	if f.saveResult != nil {
		return f.saveResult(ctx, event, items)
	}
	f.items = append(f.items, items...)
	return true, nil
}
func (f *fakeNotifications) ListByUser(context.Context, uuid.UUID, bool, bool, int, int) ([]domain.Notification, error) {
	return f.items, nil
}
func (f *fakeNotifications) MarkRead(context.Context, uuid.UUID, uuid.UUID, time.Time) error {
	return nil
}
func (f *fakeNotifications) MarkAllRead(context.Context, uuid.UUID, time.Time) error { return nil }

type publishedRealtime struct {
	channel string
	payload any
}

type fakeRealtime struct {
	items []publishedRealtime
}

func (f *fakeRealtime) PublishUser(_ context.Context, channel string, payload any) error {
	f.items = append(f.items, publishedRealtime{channel: channel, payload: payload})
	return nil
}
func (*fakeRealtime) Close() error { return nil }

func TestProcessEventIdempotent(t *testing.T) {
	notifs := &fakeNotifications{}
	realtime := &fakeRealtime{}
	calls := 0
	notifs.saveResult = func(_ context.Context, _ domain.ProcessedEvent, items []domain.Notification) (bool, error) {
		calls++
		if calls == 1 {
			notifs.items = append(notifs.items, items...)
			return true, nil
		}
		return false, nil
	}
	svc := New(notifs, realtime)
	pageID := uuid.New()
	threadID := uuid.New()
	commentID := uuid.New()
	eventID := uuid.New()
	actor := uuid.New()
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
	if err := svc.ProcessEvent(context.Background(), envelope); err != nil {
		t.Fatal(err)
	}
	if err := svc.ProcessEvent(context.Background(), envelope); err != nil {
		t.Fatal(err)
	}
	if len(notifs.items) != 3 {
		t.Fatalf("expected 3 notifications, got %d", len(notifs.items))
	}
	if len(realtime.items) != 3 {
		t.Fatalf("expected 3 realtime messages, got %d", len(realtime.items))
	}
}

func TestDedupeKeyPerRecipient(t *testing.T) {
	notifs := &fakeNotifications{}
	svc := New(notifs, &fakeRealtime{})
	pageID := uuid.New()
	threadID := uuid.New()
	mentioned := uuid.New()
	envelope := events.Envelope{
		EventID:         uuid.New(),
		EventType:       events.EventCommentMentionCreated,
		PageID:          &pageID,
		ThreadID:        &threadID,
		MentionedUserID: &mentioned,
		DedupeKey:       "mention:1",
	}
	items, err := svc.route(context.Background(), envelope)
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
	notifs := &fakeNotifications{}
	realtime := &fakeRealtime{}
	svc := New(notifs, realtime)
	pageID := uuid.New()
	threadID := uuid.New()
	commentID := uuid.New()
	mentioned := uuid.New()
	actor := uuid.New()

	err := svc.ProcessEvent(context.Background(), events.Envelope{
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
	if len(notifs.items) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(notifs.items))
	}
	if notifs.items[0].Type != domain.NotificationMentionPage {
		t.Fatalf("expected type %s, got %s", domain.NotificationMentionPage, notifs.items[0].Type)
	}
	if len(realtime.items) != 1 {
		t.Fatalf("expected 1 realtime event, got %d", len(realtime.items))
	}
	if realtime.items[0].channel != "notifications:"+mentioned.String() {
		t.Fatalf("unexpected channel %s", realtime.items[0].channel)
	}
}

func TestProcessCommentMentionPublishesRealtime(t *testing.T) {
	notifs := &fakeNotifications{}
	realtime := &fakeRealtime{}
	svc := New(notifs, realtime)
	pageID := uuid.New()
	threadID := uuid.New()
	commentID := uuid.New()
	mentioned := uuid.New()
	actor := uuid.New()

	err := svc.ProcessEvent(context.Background(), events.Envelope{
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
	if len(notifs.items) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(notifs.items))
	}
	if notifs.items[0].Type != domain.NotificationMentionComment {
		t.Fatalf("expected type %s, got %s", domain.NotificationMentionComment, notifs.items[0].Type)
	}
	if len(realtime.items) != 1 {
		t.Fatalf("expected 1 realtime event, got %d", len(realtime.items))
	}
	if realtime.items[0].channel != "notifications:"+mentioned.String() {
		t.Fatalf("unexpected channel %s", realtime.items[0].channel)
	}
}
