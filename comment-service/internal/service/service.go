package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redkindanil/flow-note/comment-service/internal/clients"
	"github.com/redkindanil/flow-note/comment-service/internal/domain"
	"github.com/redkindanil/flow-note/comment-service/internal/producer"
	"github.com/redkindanil/flow-note/comment-service/internal/repository"
	"github.com/redkindanil/flow-note/common/apperrors"
	"github.com/redkindanil/flow-note/common/events"
)

type Service struct {
	txManager    repository.TxManager
	threads      repository.ThreadRepository
	comments     repository.CommentRepository
	mentions     repository.MentionRepository
	subs         repository.SubscriptionRepository
	participants repository.ParticipantRepository
	publisher    producer.Publisher
	pageAccess   clients.PageAccessClient
}

func New(
	txManager repository.TxManager,
	threads repository.ThreadRepository,
	comments repository.CommentRepository,
	mentions repository.MentionRepository,
	subs repository.SubscriptionRepository,
	participants repository.ParticipantRepository,
	publisher producer.Publisher,
	pageAccess clients.PageAccessClient,
) *Service {
	return &Service{
		txManager:    txManager,
		threads:      threads,
		comments:     comments,
		mentions:     mentions,
		subs:         subs,
		participants: participants,
		publisher:    publisher,
		pageAccess:   pageAccess,
	}
}

func (s *Service) CreateThread(ctx context.Context, actorID, pageID uuid.UUID, req domain.CreateThreadRequest) (domain.ThreadWithComments, error) {
	if err := req.Anchor.Validate(); err != nil || !req.Body.Validate() {
		return domain.ThreadWithComments{}, apperrors.ErrInvalidInput
	}
	allowed, err := s.pageAccess.HasAccess(ctx, pageID, actorID)
	if err != nil {
		return domain.ThreadWithComments{}, err
	}
	if !allowed {
		return domain.ThreadWithComments{}, apperrors.ErrForbidden
	}
	now := time.Now().UTC()
	threadID := uuid.New()
	commentID := uuid.New()
	anchorHash, err := req.Anchor.Hash()
	if err != nil {
		return domain.ThreadWithComments{}, err
	}
	thread := domain.Thread{
		ID:              threadID,
		PageID:          pageID,
		Anchor:          req.Anchor,
		AnchorHash:      anchorHash,
		CreatedBy:       actorID,
		Status:          domain.ThreadStatusActive,
		CreatedAt:       now,
		UpdatedAt:       now,
		LastCommentedAt: &now,
		CommentsCount:   1,
	}
	comment := domain.Comment{
		ID:        commentID,
		ThreadID:  threadID,
		AuthorID:  actorID,
		Body:      req.Body,
		BodyText:  req.Body.PlainTextPreview(500),
		CreatedAt: now,
		UpdatedAt: now,
		Status:    domain.CommentStatusActive,
	}
	mentions := make([]domain.Mention, 0, len(req.Body.MentionedUserIDs()))
	for _, mentionedUserID := range req.Body.MentionedUserIDs() {
		mentions = append(mentions, domain.Mention{
			ID:              uuid.New(),
			CommentID:       commentID,
			MentionedUserID: mentionedUserID,
			CreatedAt:       now,
		})
	}
	recipientsHint, err := s.commentRecipients(ctx, pageID, threadID)
	if err != nil {
		return domain.ThreadWithComments{}, err
	}

	eventBatch, err := s.createThreadTx(ctx, actorID, thread, comment, mentions, recipientsHint)
	if err != nil {
		return domain.ThreadWithComments{}, err
	}
	if err := s.publishBatch(ctx, eventBatch); err != nil {
		return domain.ThreadWithComments{}, err
	}
	return domain.ThreadWithComments{Thread: thread, Comments: []domain.Comment{comment}}, nil
}

func (s *Service) AddReply(ctx context.Context, actorID, threadID uuid.UUID, req domain.CreateReplyRequest) (domain.Comment, error) {
	if !req.Body.Validate() {
		return domain.Comment{}, apperrors.ErrInvalidInput
	}
	thread, err := s.threads.GetThread(ctx, threadID)
	if err != nil {
		return domain.Comment{}, err
	}
	if thread.Status != domain.ThreadStatusActive {
		return domain.Comment{}, fmt.Errorf("%w: thread is not active", apperrors.ErrConflict)
	}
	allowed, err := s.pageAccess.HasAccess(ctx, thread.PageID, actorID)
	if err != nil {
		return domain.Comment{}, err
	}
	if !allowed {
		return domain.Comment{}, apperrors.ErrForbidden
	}
	comments, err := s.comments.ListCommentsByThread(ctx, threadID)
	if err != nil {
		return domain.Comment{}, err
	}
	parent, err := findRootComment(comments)
	if err != nil {
		return domain.Comment{}, apperrors.ErrNotFound
	}
	now := time.Now().UTC()
	comment := domain.Comment{
		ID:              uuid.New(),
		ThreadID:        threadID,
		ParentCommentID: &parent.ID,
		AuthorID:        actorID,
		Body:            req.Body,
		BodyText:        req.Body.PlainTextPreview(500),
		CreatedAt:       now,
		UpdatedAt:       now,
		Status:          domain.CommentStatusActive,
	}
	mentions := make([]domain.Mention, 0, len(req.Body.MentionedUserIDs()))
	for _, mentionedUserID := range req.Body.MentionedUserIDs() {
		mentions = append(mentions, domain.Mention{ID: uuid.New(), CommentID: comment.ID, MentionedUserID: mentionedUserID, CreatedAt: now})
	}
	commentRecipients, err := s.commentRecipients(ctx, thread.PageID, thread.ID)
	if err != nil {
		return domain.Comment{}, err
	}
	replyRecipients := uniqueRecipients(parent.AuthorID)
	eventBatch, err := s.persistReply(ctx, thread, parent, comment, mentions, commentRecipients, replyRecipients)
	if err != nil {
		return domain.Comment{}, err
	}
	if err := s.publishBatch(ctx, eventBatch); err != nil {
		return domain.Comment{}, err
	}
	return comment, nil
}

func (s *Service) persistReply(ctx context.Context, thread domain.Thread, parent domain.Comment, comment domain.Comment, mentions []domain.Mention, commentRecipients, replyRecipients []uuid.UUID) ([]events.Envelope, error) {
	var eventBatch []events.Envelope
	err := s.txManager.WithTx(ctx, func(ctx context.Context, tx repository.PgxTx) error {
		if err := s.comments.CreateComment(ctx, tx, comment); err != nil {
			return err
		}
		if err := s.threads.IncrementComments(ctx, tx, thread.ID, comment.CreatedAt); err != nil {
			return err
		}
		if err := s.participants.UpsertParticipant(ctx, tx, domain.ThreadParticipant{
			ThreadID: thread.ID, UserID: comment.AuthorID, Role: "commenter", CreatedAt: comment.CreatedAt, UpdatedAt: comment.CreatedAt,
		}); err != nil {
			return err
		}
		if err := s.subs.UpsertFollowing(ctx, tx, domain.ThreadSubscription{
			ThreadID: thread.ID, UserID: comment.AuthorID, IsFollowing: true, CreatedAt: comment.CreatedAt, UpdatedAt: comment.CreatedAt,
		}); err != nil {
			return err
		}
		if len(mentions) > 0 {
			if err := s.mentions.CreateMentions(ctx, tx, mentions); err != nil {
				return err
			}
		}
		commentEvent := buildEnvelope(events.EventCommentCreated, comment.AuthorID, thread.PageID, thread.ID, &comment.ID, comment.ParentCommentID, nil, thread.Anchor, comment.BodyText, fmt.Sprintf("comment_created:%s", comment.ID))
		commentEvent.RecipientsHint = commentRecipients
		replyEvent := buildEnvelope(events.EventCommentReplyCreated, comment.AuthorID, thread.PageID, thread.ID, &comment.ID, comment.ParentCommentID, nil, thread.Anchor, comment.BodyText, fmt.Sprintf("comment_reply:%s", comment.ID))
		replyEvent.RecipientsHint = replyRecipients
		eventBatch = []events.Envelope{commentEvent, replyEvent}
		eventBatch = append(eventBatch, collectMentionEvents(comment.AuthorID, thread, comment, mentions)...)
		return nil
	})
	return eventBatch, err
}

func (s *Service) ResolveThread(ctx context.Context, actorID, threadID uuid.UUID) error {
	return s.changeThreadState(ctx, actorID, threadID, domain.ThreadStatusResolved, events.EventThreadResolved)
}

func (s *Service) ReopenThread(ctx context.Context, actorID, threadID uuid.UUID) error {
	return s.changeThreadState(ctx, actorID, threadID, domain.ThreadStatusActive, events.EventThreadReopened)
}

func (s *Service) changeThreadState(ctx context.Context, actorID, threadID uuid.UUID, status, eventType string) error {
	thread, err := s.threads.GetThread(ctx, threadID)
	if err != nil {
		return err
	}
	allowed, err := s.pageAccess.HasAccess(ctx, thread.PageID, actorID)
	if err != nil {
		return err
	}
	if !allowed {
		return apperrors.ErrForbidden
	}
	now := time.Now().UTC()
	event := buildEnvelope(eventType, actorID, thread.PageID, threadID, nil, nil, nil, thread.Anchor, "", fmt.Sprintf("%s:%s", eventType, threadID))
	if err := s.txManager.WithTx(ctx, func(ctx context.Context, tx repository.PgxTx) error {
		if err := s.threads.UpdateThreadStatus(ctx, tx, threadID, status, actorID, now); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}
	return s.publishBatch(ctx, []events.Envelope{event})
}

func (s *Service) SoftDeleteComment(ctx context.Context, actorID, commentID uuid.UUID) error {
	comment, err := s.comments.GetComment(ctx, commentID)
	if err != nil {
		return err
	}
	if comment.AuthorID != actorID {
		return apperrors.ErrForbidden
	}
	return s.txManager.WithTx(ctx, func(ctx context.Context, tx repository.PgxTx) error {
		return s.comments.SoftDelete(ctx, tx, commentID, time.Now().UTC())
	})
}

func (s *Service) FollowThread(ctx context.Context, actorID, threadID uuid.UUID, follow bool) error {
	thread, err := s.threads.GetThread(ctx, threadID)
	if err != nil {
		return err
	}
	allowed, err := s.pageAccess.HasAccess(ctx, thread.PageID, actorID)
	if err != nil {
		return err
	}
	if !allowed {
		return apperrors.ErrForbidden
	}
	now := time.Now().UTC()
	eventType := events.EventThreadFollowed
	if !follow {
		eventType = events.EventThreadUnfollowed
	}
	event := buildEnvelope(eventType, actorID, thread.PageID, threadID, nil, nil, nil, thread.Anchor, "", fmt.Sprintf("%s:%s:%s", eventType, threadID, actorID))
	if err := s.txManager.WithTx(ctx, func(ctx context.Context, tx repository.PgxTx) error {
		if err := s.subs.UpsertFollowing(ctx, tx, domain.ThreadSubscription{
			ThreadID: threadID, UserID: actorID, IsFollowing: follow, CreatedAt: now, UpdatedAt: now,
		}); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}
	return s.publishBatch(ctx, []events.Envelope{event})
}

func (s *Service) ListThreads(ctx context.Context, actorID, pageID uuid.UUID, activeOnly bool, limit, offset int) ([]domain.Thread, error) {
	allowed, err := s.pageAccess.HasAccess(ctx, pageID, actorID)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, apperrors.ErrForbidden
	}
	return s.threads.ListThreadsByPage(ctx, pageID, activeOnly, limit, offset)
}

func (s *Service) GetThread(ctx context.Context, actorID, threadID uuid.UUID) (domain.ThreadWithComments, error) {
	thread, err := s.threads.GetThread(ctx, threadID)
	if err != nil {
		return domain.ThreadWithComments{}, err
	}
	allowed, err := s.pageAccess.HasAccess(ctx, thread.PageID, actorID)
	if err != nil {
		return domain.ThreadWithComments{}, err
	}
	if !allowed {
		return domain.ThreadWithComments{}, apperrors.ErrForbidden
	}
	comments, err := s.comments.ListCommentsByThread(ctx, threadID)
	if err != nil {
		return domain.ThreadWithComments{}, err
	}
	return domain.ThreadWithComments{Thread: thread, Comments: comments}, nil
}

func buildEnvelope(eventType string, actorID, pageID, threadID uuid.UUID, commentID, parentCommentID, mentionedUserID *uuid.UUID, anchor domain.Anchor, preview, dedupeKey string) events.Envelope {
	anchorJSON, _ := json.Marshal(anchor)
	return events.Envelope{
		EventID:         uuid.New(),
		EventType:       eventType,
		OccurredAt:      time.Now().UTC(),
		ActorUserID:     ptr(actorID),
		PageID:          ptr(pageID),
		ThreadID:        ptr(threadID),
		CommentID:       commentID,
		ParentCommentID: parentCommentID,
		MentionedUserID: mentionedUserID,
		Anchor:          anchorJSON,
		Preview:         preview,
		DedupeKey:       dedupeKey,
	}
}

func ptr[T any](v T) *T { return &v }

// PgxTx is aliased in repository package through pgx.Tx. Local adapter keeps service signatures expressive.
func (s *Service) createThreadTx(ctx context.Context, actorID uuid.UUID, thread domain.Thread, comment domain.Comment, mentions []domain.Mention, recipientsHint []uuid.UUID) ([]events.Envelope, error) {
	var eventBatch []events.Envelope
	err := s.txManager.WithTx(ctx, func(ctx context.Context, tx repository.PgxTx) error {
		if err := s.threads.CreateThread(ctx, tx, thread); err != nil {
			return err
		}
		if err := s.comments.CreateComment(ctx, tx, comment); err != nil {
			return err
		}
		if len(mentions) > 0 {
			if err := s.mentions.CreateMentions(ctx, tx, mentions); err != nil {
				return err
			}
		}
		if err := s.participants.UpsertParticipant(ctx, tx, domain.ThreadParticipant{
			ThreadID: thread.ID, UserID: actorID, Role: "author", CreatedAt: thread.CreatedAt, UpdatedAt: thread.CreatedAt,
		}); err != nil {
			return err
		}
		if err := s.subs.UpsertFollowing(ctx, tx, domain.ThreadSubscription{
			ThreadID: thread.ID, UserID: actorID, IsFollowing: true, CreatedAt: thread.CreatedAt, UpdatedAt: thread.CreatedAt,
		}); err != nil {
			return err
		}
		threadEvent := buildEnvelope(events.EventCommentThreadCreated, actorID, thread.PageID, thread.ID, &comment.ID, nil, nil, thread.Anchor, comment.BodyText, fmt.Sprintf("thread_created:%s", thread.ID))
		commentEvent := buildEnvelope(events.EventCommentCreated, actorID, thread.PageID, thread.ID, &comment.ID, nil, nil, thread.Anchor, comment.BodyText, fmt.Sprintf("comment_created:%s", comment.ID))
		commentEvent.RecipientsHint = recipientsHint
		eventBatch = []events.Envelope{threadEvent, commentEvent}
		eventBatch = append(eventBatch, collectMentionEvents(actorID, thread, comment, mentions)...)
		return nil
	})
	return eventBatch, err
}

func collectMentionEvents(actorID uuid.UUID, thread domain.Thread, comment domain.Comment, mentions []domain.Mention) []events.Envelope {
	items := make([]events.Envelope, 0, len(mentions))
	for _, mention := range mentions {
		mentioned := mention.MentionedUserID
		items = append(items, buildEnvelope(
			events.EventCommentMentionCreated,
			actorID,
			thread.PageID,
			thread.ID,
			&comment.ID,
			comment.ParentCommentID,
			&mentioned,
			thread.Anchor,
			comment.BodyText,
			fmt.Sprintf("comment_mention:%s:%s", comment.ID, mentioned),
		))
	}
	return items
}

func (s *Service) commentRecipients(ctx context.Context, pageID, threadID uuid.UUID) ([]uuid.UUID, error) {
	owner, err := s.pageAccess.GetPageOwner(ctx, pageID)
	if err != nil {
		return nil, err
	}
	watchers, err := s.pageAccess.GetPageWatchers(ctx, pageID)
	if err != nil {
		return nil, err
	}
	followers, err := s.subs.ListFollowers(ctx, threadID)
	if err != nil {
		return nil, err
	}
	participants, err := s.participants.ListParticipants(ctx, threadID)
	if err != nil {
		return nil, err
	}
	recipients := uniqueRecipients(owner)
	recipients = append(recipients, watchers...)
	recipients = append(recipients, followers...)
	for _, participant := range participants {
		recipients = append(recipients, participant.UserID)
	}
	return uniqueRecipients(recipients...), nil
}

func uniqueRecipients(ids ...uuid.UUID) []uuid.UUID {
	seen := make(map[uuid.UUID]struct{}, len(ids))
	out := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		if id == uuid.Nil {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

func (s *Service) publishBatch(ctx context.Context, items []events.Envelope) error {
	for _, item := range items {
		if err := s.publisher.Publish(ctx, item); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) mustThread(ctx context.Context, threadID uuid.UUID) (domain.Thread, error) {
	thread, err := s.threads.GetThread(ctx, threadID)
	if err != nil {
		return domain.Thread{}, err
	}
	if thread.Status == domain.ThreadStatusDeleted {
		return domain.Thread{}, apperrors.ErrNotFound
	}
	return thread, nil
}

func ignoreNotFound(err error) error {
	if errors.Is(err, apperrors.ErrNotFound) {
		return nil
	}
	return err
}

func findRootComment(items []domain.Comment) (domain.Comment, error) {
	for _, item := range items {
		if item.ParentCommentID == nil {
			return item, nil
		}
	}
	return domain.Comment{}, apperrors.ErrNotFound
}
