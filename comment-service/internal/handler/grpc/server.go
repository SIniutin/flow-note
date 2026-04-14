package grpc

import (
	"context"
	"strings"

	commentv1 "github.com/flow-note/api-contracts/generated/proto/comment/v1"
	"github.com/flow-note/comment-service/internal/domain"
	commentservice "github.com/flow-note/comment-service/internal/service"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type Server struct {
	commentv1.UnimplementedCommentServiceServer

	service *commentservice.Service
}

func New(service *commentservice.Service) *Server {
	return &Server{service: service}
}

func (s *Server) MakeComment(ctx context.Context, req *commentv1.CreateCommentRequest) (*commentv1.CreateCommentResponce, error) {
	if err := ctx.Err(); err != nil {
		return nil, status.Error(codes.Canceled, err.Error())
	}

	cmd, err := toCreateCommentCommand(req)
	if err != nil {
		return nil, err
	}

	comment, err := s.service.MakeComment(ctx, cmd)
	if err != nil {
		return nil, mapDomainError(err)
	}

	return &commentv1.CreateCommentResponce{Comment: toProtoComment(comment)}, nil
}

func (s *Server) SubscribeToComment(ctx context.Context, req *commentv1.SubscribeToCommentRequest) (*emptypb.Empty, error) {
	if err := ctx.Err(); err != nil {
		return nil, status.Error(codes.Canceled, err.Error())
	}

	cmd, err := toSubscribeCommand(req.GetUserId(), req.GetPageId())
	if err != nil {
		return nil, err
	}

	if err := s.service.SubscribeToComments(ctx, cmd); err != nil {
		return nil, mapDomainError(err)
	}
	return &emptypb.Empty{}, nil
}

func (s *Server) UnsubscribeToComment(ctx context.Context, req *commentv1.UnsubscribeToCommentRequest) (*emptypb.Empty, error) {
	if err := ctx.Err(); err != nil {
		return nil, status.Error(codes.Canceled, err.Error())
	}

	cmd, err := toUnsubscribeCommand(req.GetUserId(), req.GetPageId())
	if err != nil {
		return nil, err
	}

	if err := s.service.UnsubscribeFromComments(ctx, cmd); err != nil {
		return nil, mapDomainError(err)
	}
	return &emptypb.Empty{}, nil
}

func (s *Server) ListComments(ctx context.Context, req *commentv1.ListCommentsRequest) (*commentv1.ListCommentsResponse, error) {
	if err := ctx.Err(); err != nil {
		return nil, status.Error(codes.Canceled, err.Error())
	}

	pageID, err := parseUUID(req.GetPageId(), "page_id")
	if err != nil {
		return nil, err
	}

	items, err := s.service.ListComments(ctx, domain.ListCommentsQuery{PageID: pageID})
	if err != nil {
		return nil, mapDomainError(err)
	}

	out := make([]*commentv1.Comment, 0, len(items))
	for _, item := range items {
		out = append(out, toProtoComment(item))
	}

	return &commentv1.ListCommentsResponse{Comments: out}, nil
}

func (s *Server) GetComment(ctx context.Context, req *commentv1.GetCommentRequest) (*commentv1.GetCommentResponce, error) {
	if err := ctx.Err(); err != nil {
		return nil, status.Error(codes.Canceled, err.Error())
	}

	commentID, err := parseUUID(req.GetCommentId(), "comment_id")
	if err != nil {
		return nil, err
	}

	comment, err := s.service.GetComment(ctx, commentID)
	if err != nil {
		return nil, mapDomainError(err)
	}

	return &commentv1.GetCommentResponce{Comment: toProtoComment(comment)}, nil
}

func toCreateCommentCommand(req *commentv1.CreateCommentRequest) (domain.CreateCommentCommand, error) {
	userID, err := parseUUID(req.GetUserId(), "user_id")
	if err != nil {
		return domain.CreateCommentCommand{}, err
	}
	pageID, err := parseUUID(req.GetPageId(), "page_id")
	if err != nil {
		return domain.CreateCommentCommand{}, err
	}

	cmd := domain.CreateCommentCommand{
		UserID: userID,
		PageID: pageID,
		Body:   req.GetBody(),
	}

	if strings.TrimSpace(req.GetParentId()) != "" {
		parentID, err := parseUUID(req.GetParentId(), "parent_id")
		if err != nil {
			return domain.CreateCommentCommand{}, err
		}
		cmd.ParentID = &parentID
	}

	if strings.TrimSpace(req.GetBodyId()) != "" {
		bodyID, err := parseUUID(req.GetBodyId(), "body_id")
		if err != nil {
			return domain.CreateCommentCommand{}, err
		}
		cmd.BodyID = &bodyID
	}

	return cmd, nil
}

func toSubscribeCommand(rawUserID, rawPageID string) (domain.SubscribeToCommentsCommand, error) {
	userID, err := parseUUID(rawUserID, "user_id")
	if err != nil {
		return domain.SubscribeToCommentsCommand{}, err
	}
	pageID, err := parseUUID(rawPageID, "page_id")
	if err != nil {
		return domain.SubscribeToCommentsCommand{}, err
	}
	cmd := domain.SubscribeToCommentsCommand{UserID: userID, PageID: pageID}
	if err := cmd.Validate(); err != nil {
		return domain.SubscribeToCommentsCommand{}, mapDomainError(err)
	}
	return cmd, nil
}

func toUnsubscribeCommand(rawUserID, rawPageID string) (domain.UnsubscribeFromCommentsCommand, error) {
	userID, err := parseUUID(rawUserID, "user_id")
	if err != nil {
		return domain.UnsubscribeFromCommentsCommand{}, err
	}
	pageID, err := parseUUID(rawPageID, "page_id")
	if err != nil {
		return domain.UnsubscribeFromCommentsCommand{}, err
	}
	cmd := domain.UnsubscribeFromCommentsCommand{UserID: userID, PageID: pageID}
	if err := cmd.Validate(); err != nil {
		return domain.UnsubscribeFromCommentsCommand{}, mapDomainError(err)
	}
	return cmd, nil
}

func parseUUID(raw, field string) (uuid.UUID, error) {
	id, err := uuid.Parse(strings.TrimSpace(raw))
	if err != nil {
		return uuid.Nil, status.Errorf(codes.InvalidArgument, "invalid %s", field)
	}
	return id, nil
}

func toProtoComment(comment domain.Comment) *commentv1.Comment {
	msg := &commentv1.Comment{
		Id:        comment.ID.String(),
		UserId:    comment.UserID.String(),
		PageId:    comment.PageID.String(),
		Deleted:   comment.Deleted,
		Body:      comment.Body,
		CreatedAt: timestamppb.New(comment.CreatedAt),
	}

	if comment.ParentID != nil {
		msg.ParentId = comment.ParentID.String()
	}
	if comment.BodyID != nil {
		msg.BodyId = comment.BodyID.String()
	}

	return msg
}

func mapDomainError(err error) error {
	if err == nil {
		return nil
	}
	if status.Code(err) != codes.Unknown {
		return err
	}

	switch err {
	case domain.ErrInvalidCommentID,
		domain.ErrInvalidUserID,
		domain.ErrInvalidPageID,
		domain.ErrInvalidBodyID,
		domain.ErrEmptyCommentBody:
		return status.Error(codes.InvalidArgument, err.Error())
	case domain.ErrCommentAlreadyDeleted:
		return status.Error(codes.FailedPrecondition, err.Error())
	default:
		return status.Error(codes.Internal, err.Error())
	}
}
