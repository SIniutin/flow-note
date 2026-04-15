package service

import (
	"context"
	"errors"
	"time"

	"github.com/flow-note/comment-service/internal/domain"
	"github.com/flow-note/comment-service/internal/repository"
	"github.com/flow-note/common/apperrors"
	"github.com/flow-note/common/authctx"
	"github.com/flow-note/common/broker"
	"github.com/flow-note/common/perm"
	"github.com/google/uuid"
)

type EventPublisher interface {
	Publish(ctx context.Context, event broker.Event) error
}

type Service struct {
	txManager     repository.TxManager
	comments      repository.CommentRepository
	subscriptions repository.SubscriptionRepository
	publisher     EventPublisher
}

func New(
	txManager repository.TxManager,
	comments repository.CommentRepository,
	subscriptions repository.SubscriptionRepository,
	publisher EventPublisher,
) *Service {
	return &Service{
		txManager:     txManager,
		comments:      comments,
		subscriptions: subscriptions,
		publisher:     publisher,
	}
}

func (s *Service) MakeComment(ctx context.Context, credentials *authctx.UserCredentials, cmd domain.CreateCommentCommand) (domain.Comment, error) {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleCommenter) {
		return domain.Comment{}, perm.ErrCommentPermissionRequired
	}

	var parent *domain.Comment
	if cmd.ParentID != nil || cmd.ParentBodyID != nil {
		var parentComment domain.Comment
		var err error
		if cmd.ParentID != nil {
			parentComment, err = s.comments.GetComment(ctx, domain.GetCommentQuery{CommentID: *cmd.ParentID})
		} else {
			parentComment, err = s.comments.GetRootCommentByPageIDAndBodyID(ctx, cmd.PageID, *cmd.ParentBodyID)
		}
		if err != nil {
			return domain.Comment{}, err
		}
		if parentComment.PageID != cmd.PageID {
			return domain.Comment{}, apperrors.ErrInvalidInput
		}
		cmd.ParentID = &parentComment.ID
		parentCopy := parentComment
		parent = &parentCopy
	}

	comment, err := domain.NewComment(time.Now().UTC(), cmd)
	if err != nil {
		return domain.Comment{}, err
	}

	err = s.txManager.WithTx(ctx, func(ctx context.Context, tx repository.PgxTx) error {
		return s.comments.CreateComment(ctx, tx, comment)
	})
	if err != nil {
		return domain.Comment{}, err
	}

	if err := s.publishCommentEvents(ctx, comment, parent); err != nil {
		return domain.Comment{}, err
	}

	return comment, nil
}

func (s *Service) GetComment(ctx context.Context, credentials *authctx.UserCredentials, commentID uuid.UUID) (domain.Comment, error) {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleViewer) {
		return domain.Comment{}, perm.ErrViewerPermissionRequired
	}

	return s.comments.GetComment(ctx, domain.GetCommentQuery{CommentID: commentID})
}

func (s *Service) ListComments(ctx context.Context, credentials *authctx.UserCredentials, query domain.ListCommentsQuery) ([]domain.Comment, error) {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleViewer) {
		return []domain.Comment{}, perm.ErrViewerPermissionRequired
	}

	return s.comments.ListComments(ctx, query)
}

func (s *Service) DeleteComment(ctx context.Context, credentials *authctx.UserCredentials, actorID, commentID uuid.UUID) error {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleCommenter) {
		return perm.ErrCommentPermissionRequired
	}

	comment, err := s.comments.GetComment(ctx, domain.GetCommentQuery{CommentID: commentID})
	if err != nil {
		return err
	}
	if !comment.CanBeDeletedBy(actorID) {
		return apperrors.ErrForbidden
	}
	if err := comment.SoftDelete(time.Now().UTC()); err != nil {
		return err
	}
	return s.txManager.WithTx(ctx, func(ctx context.Context, tx repository.PgxTx) error {
		return s.comments.SoftDeleteComment(ctx, tx, comment, comment.UpdatedAt)
	})
}

func (s *Service) SubscribeToComments(ctx context.Context, credentials *authctx.UserCredentials, cmd domain.SubscribeToCommentsCommand) error {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleViewer) {
		return perm.ErrViewerPermissionRequired
	}

	subscription, err := domain.NewCommentSubscription(time.Now().UTC(), cmd)
	if err != nil {
		return err
	}

	existing, err := s.subscriptions.GetSubscription(ctx, cmd.UserID.String(), cmd.PageID.String())
	if err == nil {
		existing.Activate(time.Now().UTC())
		subscription = existing
	} else if !errors.Is(err, apperrors.ErrNotFound) {
		return err
	}

	return s.txManager.WithTx(ctx, func(ctx context.Context, tx repository.PgxTx) error {
		return s.subscriptions.UpsertSubscription(ctx, tx, subscription)
	})
}

func (s *Service) UnsubscribeFromComments(ctx context.Context, credentials *authctx.UserCredentials, cmd domain.UnsubscribeFromCommentsCommand) error {
	if !perm.HasRequiredPermission(credentials.Role, perm.RoleViewer) {
		return perm.ErrViewerPermissionRequired
	}

	existing, err := s.subscriptions.GetSubscription(ctx, cmd.UserID.String(), cmd.PageID.String())
	if err != nil {
		if errors.Is(err, apperrors.ErrNotFound) {
			return nil
		}
		return err
	}

	existing.Deactivate(time.Now().UTC())
	return s.txManager.WithTx(ctx, func(ctx context.Context, tx repository.PgxTx) error {
		return s.subscriptions.UpsertSubscription(ctx, tx, existing)
	})
}

func (s *Service) publishCommentEvents(ctx context.Context, comment domain.Comment, parent *domain.Comment) error {
	if s.publisher == nil {
		return nil
	}

	if parent != nil {
		if parent.UserID == comment.UserID {
			return nil
		}
		return s.publisher.Publish(ctx, broker.Event{
			UserID:   parent.UserID.String(),
			ActorID:  comment.UserID.String(),
			EntityID: comment.ID.String(),
			PageID:   comment.PageID.String(),
			Type:     broker.EventCommentReply,
		})
	}

	subs, err := s.subscriptions.ListActiveSubscriptionsByPage(ctx, comment.PageID.String())
	if err != nil {
		return err
	}

	for _, sub := range subs {
		if sub.UserID == comment.UserID {
			continue
		}
		if err := s.publisher.Publish(ctx, broker.Event{
			UserID:   sub.UserID.String(),
			ActorID:  comment.UserID.String(),
			EntityID: comment.ID.String(),
			PageID:   comment.PageID.String(),
			Type:     broker.EventCommentThread,
		}); err != nil {
			return err
		}
	}

	return nil
}
