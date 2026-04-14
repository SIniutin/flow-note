package service

import (
	"context"
	"errors"
	"time"

	"github.com/flow-note/comment-service/internal/domain"
	"github.com/flow-note/comment-service/internal/repository"
	"github.com/flow-note/common/apperrors"
	"github.com/google/uuid"
)

type Service struct {
	txManager     repository.TxManager
	comments      repository.CommentRepository
	subscriptions repository.SubscriptionRepository
}

func New(txManager repository.TxManager, comments repository.CommentRepository, subscriptions repository.SubscriptionRepository) *Service {
	return &Service{
		txManager:     txManager,
		comments:      comments,
		subscriptions: subscriptions,
	}
}

func (s *Service) MakeComment(ctx context.Context, cmd domain.CreateCommentCommand) (domain.Comment, error) {
	comment, err := domain.NewComment(time.Now().UTC(), cmd)
	if err != nil {
		return domain.Comment{}, err
	}

	if cmd.ParentID != nil {
		parent, err := s.comments.GetComment(ctx, domain.GetCommentQuery{CommentID: *cmd.ParentID})
		if err != nil {
			return domain.Comment{}, err
		}
		if parent.PageID != cmd.PageID {
			return domain.Comment{}, apperrors.ErrInvalidInput
		}
	}

	err = s.txManager.WithTx(ctx, func(ctx context.Context, tx repository.PgxTx) error {
		return s.comments.CreateComment(ctx, tx, comment)
	})
	if err != nil {
		return domain.Comment{}, err
	}

	return comment, nil
}

func (s *Service) GetComment(ctx context.Context, commentID uuid.UUID) (domain.Comment, error) {
	return s.comments.GetComment(ctx, domain.GetCommentQuery{CommentID: commentID})
}

func (s *Service) ListComments(ctx context.Context, query domain.ListCommentsQuery) ([]domain.Comment, error) {
	return s.comments.ListComments(ctx, query)
}

func (s *Service) DeleteComment(ctx context.Context, actorID, commentID uuid.UUID) error {
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

func (s *Service) SubscribeToComments(ctx context.Context, cmd domain.SubscribeToCommentsCommand) error {
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

func (s *Service) UnsubscribeFromComments(ctx context.Context, cmd domain.UnsubscribeFromCommentsCommand) error {
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
