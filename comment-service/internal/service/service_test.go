package service

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/flow-note/comment-service/internal/domain"
	"github.com/flow-note/common/events"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type fakePageAccess struct{}

func (fakePageAccess) HasAccess(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return true, nil
}
func (fakePageAccess) GetPageOwner(context.Context, uuid.UUID) (uuid.UUID, error) {
	return uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), nil
}
func (fakePageAccess) GetPageWatchers(context.Context, uuid.UUID) ([]uuid.UUID, error) {
	return []uuid.UUID{
		uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
		uuid.MustParse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
	}, nil
}
func (fakePageAccess) GetPageTitle(context.Context, uuid.UUID) (string, error) { return "", nil }

type fakeRepo struct {
	threads      map[uuid.UUID]domain.Thread
	comments     map[uuid.UUID]domain.Comment
	published    []events.Envelope
	follows      map[uuid.UUID]bool
	participants map[uuid.UUID][]domain.ThreadParticipant
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		threads:      map[uuid.UUID]domain.Thread{},
		comments:     map[uuid.UUID]domain.Comment{},
		follows:      map[uuid.UUID]bool{},
		participants: map[uuid.UUID][]domain.ThreadParticipant{},
	}
}

func (f *fakeRepo) WithTx(ctx context.Context, fn func(context.Context, pgx.Tx) error) error {
	return fn(ctx, nil)
}
func (f *fakeRepo) CreateThread(_ context.Context, _ pgx.Tx, thread domain.Thread) error {
	f.threads[thread.ID] = thread
	return nil
}
func (f *fakeRepo) UpdateThreadStatus(_ context.Context, _ pgx.Tx, threadID uuid.UUID, status string, actor uuid.UUID, at time.Time) error {
	thread := f.threads[threadID]
	thread.Status = status
	thread.UpdatedAt = at
	thread.ResolvedBy = &actor
	thread.ResolvedAt = &at
	f.threads[threadID] = thread
	return nil
}
func (f *fakeRepo) IncrementComments(_ context.Context, _ pgx.Tx, threadID uuid.UUID, at time.Time) error {
	thread := f.threads[threadID]
	thread.CommentsCount++
	thread.LastCommentedAt = &at
	f.threads[threadID] = thread
	return nil
}
func (f *fakeRepo) GetThread(_ context.Context, threadID uuid.UUID) (domain.Thread, error) {
	return f.threads[threadID], nil
}
func (f *fakeRepo) ListThreadsByPage(_ context.Context, pageID uuid.UUID, _ bool, _, _ int) ([]domain.Thread, error) {
	var out []domain.Thread
	for _, thread := range f.threads {
		if thread.PageID == pageID {
			out = append(out, thread)
		}
	}
	return out, nil
}
func (f *fakeRepo) CreateComment(_ context.Context, _ pgx.Tx, comment domain.Comment) error {
	f.comments[comment.ID] = comment
	return nil
}
func (f *fakeRepo) GetComment(_ context.Context, commentID uuid.UUID) (domain.Comment, error) {
	return f.comments[commentID], nil
}
func (f *fakeRepo) ListCommentsByThread(_ context.Context, threadID uuid.UUID) ([]domain.Comment, error) {
	var out []domain.Comment
	for _, comment := range f.comments {
		if comment.ThreadID == threadID {
			out = append(out, comment)
		}
	}
	return out, nil
}
func (f *fakeRepo) SoftDelete(_ context.Context, _ pgx.Tx, commentID uuid.UUID, at time.Time) error {
	comment := f.comments[commentID]
	comment.DeletedAt = &at
	comment.Status = domain.CommentStatusDeleted
	f.comments[commentID] = comment
	return nil
}
func (f *fakeRepo) CreateMentions(context.Context, pgx.Tx, []domain.Mention) error { return nil }
func (f *fakeRepo) UpsertFollowing(_ context.Context, _ pgx.Tx, sub domain.ThreadSubscription) error {
	f.follows[sub.UserID] = sub.IsFollowing
	return nil
}
func (f *fakeRepo) IsFollowing(_ context.Context, _, userID uuid.UUID) (bool, error) {
	return f.follows[userID], nil
}
func (f *fakeRepo) ListFollowers(_ context.Context, _ uuid.UUID) ([]uuid.UUID, error) {
	out := make([]uuid.UUID, 0, len(f.follows))
	for userID, following := range f.follows {
		if following {
			out = append(out, userID)
		}
	}
	return out, nil
}
func (f *fakeRepo) UpsertParticipant(_ context.Context, _ pgx.Tx, participant domain.ThreadParticipant) error {
	current := f.participants[participant.ThreadID]
	for idx, item := range current {
		if item.UserID == participant.UserID && item.Role == participant.Role {
			current[idx] = participant
			f.participants[participant.ThreadID] = current
			return nil
		}
	}
	f.participants[participant.ThreadID] = append(current, participant)
	return nil
}
func (f *fakeRepo) ListParticipants(_ context.Context, threadID uuid.UUID) ([]domain.ThreadParticipant, error) {
	return f.participants[threadID], nil
}
func (f *fakeRepo) Publish(_ context.Context, event events.Envelope) error {
	f.published = append(f.published, event)
	return nil
}

func TestCreateThreadPublishesEvents(t *testing.T) {
	repo := newFakeRepo()
	svc := New(repo, repo, repo, repo, repo, repo, repo, fakePageAccess{})
	pageID := uuid.New()
	actorID := uuid.New()
	start, end := 0, 5
	mentioned := uuid.New()
	body := domain.CommentBody{
		{Type: "text", Text: "hello "},
		{Type: "mention", UserID: &mentioned, Label: "alice"},
	}
	item, err := svc.CreateThread(context.Background(), actorID, pageID, domain.CreateThreadRequest{
		Anchor: domain.Anchor{Kind: "text_range", BlockID: "b1", StartOffset: &start, EndOffset: &end},
		Body:   body,
	})
	if err != nil {
		t.Fatal(err)
	}
	if item.Thread.CommentsCount != 1 {
		t.Fatalf("expected 1 comment, got %d", item.Thread.CommentsCount)
	}
	if len(repo.published) != 3 {
		t.Fatalf("expected 3 published events, got %d", len(repo.published))
	}
	var envelope map[string]any
	eventBody, _ := json.Marshal(repo.published[1])
	if err := json.Unmarshal(eventBody, &envelope); err != nil {
		t.Fatal(err)
	}
	recipients, ok := envelope["recipients_hint"].([]any)
	if !ok || len(recipients) != 3 {
		t.Fatalf("expected recipients_hint with 3 recipients, got %#v", envelope["recipients_hint"])
	}
}

func TestAddReplyCreatesReplyEvent(t *testing.T) {
	repo := newFakeRepo()
	svc := New(repo, repo, repo, repo, repo, repo, repo, fakePageAccess{})
	pageID := uuid.New()
	actorID := uuid.New()
	start, end := 0, 3
	thread, err := svc.CreateThread(context.Background(), actorID, pageID, domain.CreateThreadRequest{
		Anchor: domain.Anchor{Kind: "text_range", BlockID: "b1", StartOffset: &start, EndOffset: &end},
		Body:   domain.CommentBody{{Type: "text", Text: "root"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	replyAuthor := uuid.New()
	rootID := thread.Comments[0].ID
	reply, err := svc.AddReply(context.Background(), replyAuthor, thread.Thread.ID, domain.CreateReplyRequest{
		Body: domain.CommentBody{{Type: "text", Text: "reply"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if reply.ParentCommentID == nil {
		t.Fatal("expected parent comment id")
	}
	if *reply.ParentCommentID != rootID {
		t.Fatalf("expected reply parent %s, got %s", rootID, *reply.ParentCommentID)
	}
	if len(repo.published) != 4 {
		t.Fatalf("expected 4 published events, got %d", len(repo.published))
	}
	var commentEventEnvelope map[string]any
	eventBody, _ := json.Marshal(repo.published[2])
	if err := json.Unmarshal(eventBody, &commentEventEnvelope); err != nil {
		t.Fatal(err)
	}
	recipients, ok := commentEventEnvelope["recipients_hint"].([]any)
	if !ok || len(recipients) < 4 {
		t.Fatalf("expected recipients_hint for comment event, got %#v", commentEventEnvelope["recipients_hint"])
	}
}

func TestCreateThreadPublishesMentionEvent(t *testing.T) {
	repo := newFakeRepo()
	svc := New(repo, repo, repo, repo, repo, repo, repo, fakePageAccess{})
	pageID := uuid.New()
	actorID := uuid.New()
	start, end := 0, 5
	mentioned := uuid.New()

	_, err := svc.CreateThread(context.Background(), actorID, pageID, domain.CreateThreadRequest{
		Anchor: domain.Anchor{Kind: "text_range", BlockID: "b1", StartOffset: &start, EndOffset: &end},
		Body: domain.CommentBody{
			{Type: "text", Text: "hello "},
			{Type: "mention", UserID: &mentioned, Label: "alice"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.published) != 3 {
		t.Fatalf("expected 3 published events, got %d", len(repo.published))
	}
	mentionEvent := repo.published[2]
	if mentionEvent.EventType != events.EventCommentMentionCreated {
		t.Fatalf("expected %s, got %s", events.EventCommentMentionCreated, mentionEvent.EventType)
	}
	if mentionEvent.MentionedUserID == nil || *mentionEvent.MentionedUserID != mentioned {
		t.Fatalf("expected mentioned user %s, got %#v", mentioned, mentionEvent.MentionedUserID)
	}
}

func TestResolveAndReopenThread(t *testing.T) {
	repo := newFakeRepo()
	svc := New(repo, repo, repo, repo, repo, repo, repo, fakePageAccess{})
	pageID := uuid.New()
	actorID := uuid.New()
	start, end := 0, 3
	thread, err := svc.CreateThread(context.Background(), actorID, pageID, domain.CreateThreadRequest{
		Anchor: domain.Anchor{Kind: "text_range", BlockID: "b1", StartOffset: &start, EndOffset: &end},
		Body:   domain.CommentBody{{Type: "text", Text: "root"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.ResolveThread(context.Background(), actorID, thread.Thread.ID); err != nil {
		t.Fatal(err)
	}
	if repo.threads[thread.Thread.ID].Status != domain.ThreadStatusResolved {
		t.Fatalf("expected resolved, got %s", repo.threads[thread.Thread.ID].Status)
	}
	if err := svc.ReopenThread(context.Background(), actorID, thread.Thread.ID); err != nil {
		t.Fatal(err)
	}
	if repo.threads[thread.Thread.ID].Status != domain.ThreadStatusActive {
		t.Fatalf("expected active, got %s", repo.threads[thread.Thread.ID].Status)
	}
}

func TestAddReplyToResolvedThreadFails(t *testing.T) {
	repo := newFakeRepo()
	svc := New(repo, repo, repo, repo, repo, repo, repo, fakePageAccess{})
	pageID := uuid.New()
	actorID := uuid.New()
	start, end := 0, 3
	thread, err := svc.CreateThread(context.Background(), actorID, pageID, domain.CreateThreadRequest{
		Anchor: domain.Anchor{Kind: "text_range", BlockID: "b1", StartOffset: &start, EndOffset: &end},
		Body:   domain.CommentBody{{Type: "text", Text: "root"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.ResolveThread(context.Background(), actorID, thread.Thread.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.AddReply(context.Background(), uuid.New(), thread.Thread.ID, domain.CreateReplyRequest{
		Body: domain.CommentBody{{Type: "text", Text: "reply"}},
	}); err == nil {
		t.Fatal("expected error for reply to resolved thread")
	}
}

func TestFollowUnfollow(t *testing.T) {
	repo := newFakeRepo()
	svc := New(repo, repo, repo, repo, repo, repo, repo, fakePageAccess{})
	pageID := uuid.New()
	actorID := uuid.New()
	start, end := 0, 3
	thread, err := svc.CreateThread(context.Background(), actorID, pageID, domain.CreateThreadRequest{
		Anchor: domain.Anchor{Kind: "text_range", BlockID: "b1", StartOffset: &start, EndOffset: &end},
		Body:   domain.CommentBody{{Type: "text", Text: "root"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	follower := uuid.New()
	if err := svc.FollowThread(context.Background(), follower, thread.Thread.ID, true); err != nil {
		t.Fatal(err)
	}
	if !repo.follows[follower] {
		t.Fatal("expected follower to be following")
	}
	if err := svc.FollowThread(context.Background(), follower, thread.Thread.ID, false); err != nil {
		t.Fatal(err)
	}
	if repo.follows[follower] {
		t.Fatal("expected follower to be unfollowed")
	}
	if len(repo.published) != 4 {
		t.Fatalf("expected 4 published events, got %d", len(repo.published))
	}
	if repo.published[2].EventType != events.EventThreadFollowed {
		t.Fatalf("expected %s, got %s", events.EventThreadFollowed, repo.published[2].EventType)
	}
	if repo.published[3].EventType != events.EventThreadUnfollowed {
		t.Fatalf("expected %s, got %s", events.EventThreadUnfollowed, repo.published[3].EventType)
	}
}
