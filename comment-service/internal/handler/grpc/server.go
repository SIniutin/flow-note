package grpc

import (
	"context"
	"time"

	"github.com/flow-note/comment-service/internal/domain"
	"github.com/flow-note/comment-service/internal/service"
	"github.com/flow-note/common/authctx"
	commentv1 "github.com/flow-note/proto/comment/v1"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type Server struct {
	commentv1.UnimplementedCommentServiceServer
	svc *service.Service
}

func New(svc *service.Service) *Server {
	return &Server{svc: svc}
}

func (s *Server) CreateThread(ctx context.Context, req *commentv1.CreateThreadRequest) (*commentv1.CreateThreadResponse, error) {
	actorID, err := actorFromContext(ctx)
	if err != nil {
		return nil, err
	}
	pageID, err := parseUUID(req.GetPageId(), "page_id")
	if err != nil {
		return nil, err
	}
	item, err := s.svc.CreateThread(ctx, actorID, pageID, domain.CreateThreadRequest{
		Anchor: toDomainAnchor(req.GetAnchor()),
		Body:   toDomainBody(req.GetBody()),
	})
	if err != nil {
		return nil, err
	}
	root := item.Comments[0]
	return &commentv1.CreateThreadResponse{
		Thread:      toProtoThread(item.Thread),
		RootComment: toProtoComment(root),
	}, nil
}

func (s *Server) ListThreads(ctx context.Context, req *commentv1.ListThreadsRequest) (*commentv1.ListThreadsResponse, error) {
	actorID, err := actorFromContext(ctx)
	if err != nil {
		return nil, err
	}
	pageID, err := parseUUID(req.GetPageId(), "page_id")
	if err != nil {
		return nil, err
	}
	limit := int(req.GetLimit())
	if limit <= 0 {
		limit = 20
	}
	items, err := s.svc.ListThreads(ctx, actorID, pageID, req.GetActiveOnly(), limit, int(req.GetOffset()))
	if err != nil {
		return nil, err
	}
	out := make([]*commentv1.Thread, 0, len(items))
	for _, item := range items {
		out = append(out, toProtoThread(item))
	}
	return &commentv1.ListThreadsResponse{Items: out}, nil
}

func (s *Server) ListDiscussions(ctx context.Context, req *commentv1.ListDiscussionsRequest) (*commentv1.ListThreadsResponse, error) {
	return s.ListThreads(ctx, &commentv1.ListThreadsRequest{
		PageId:     req.GetPageId(),
		ActiveOnly: true,
		Limit:      req.GetLimit(),
		Offset:     req.GetOffset(),
	})
}

func (s *Server) GetThread(ctx context.Context, req *commentv1.GetThreadRequest) (*commentv1.GetThreadResponse, error) {
	actorID, err := actorFromContext(ctx)
	if err != nil {
		return nil, err
	}
	threadID, err := parseUUID(req.GetThreadId(), "thread_id")
	if err != nil {
		return nil, err
	}
	item, err := s.svc.GetThread(ctx, actorID, threadID)
	if err != nil {
		return nil, err
	}
	comments := make([]*commentv1.Comment, 0, len(item.Comments))
	for _, comment := range item.Comments {
		comments = append(comments, toProtoComment(comment))
	}
	return &commentv1.GetThreadResponse{
		Item: &commentv1.ThreadWithComments{
			Thread:   toProtoThread(item.Thread),
			Comments: comments,
		},
	}, nil
}

func (s *Server) AddReply(ctx context.Context, req *commentv1.AddReplyRequest) (*commentv1.AddReplyResponse, error) {
	actorID, err := actorFromContext(ctx)
	if err != nil {
		return nil, err
	}
	threadID, err := parseUUID(req.GetThreadId(), "thread_id")
	if err != nil {
		return nil, err
	}
	item, err := s.svc.AddReply(ctx, actorID, threadID, domain.CreateReplyRequest{Body: toDomainBody(req.GetBody())})
	if err != nil {
		return nil, err
	}
	return &commentv1.AddReplyResponse{Comment: toProtoComment(item)}, nil
}

func (s *Server) ResolveThread(ctx context.Context, req *commentv1.ChangeThreadStateRequest) (*emptypb.Empty, error) {
	actorID, err := actorFromContext(ctx)
	if err != nil {
		return nil, err
	}
	threadID, err := parseUUID(req.GetThreadId(), "thread_id")
	if err != nil {
		return nil, err
	}
	if err := s.svc.ResolveThread(ctx, actorID, threadID); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func (s *Server) ReopenThread(ctx context.Context, req *commentv1.ChangeThreadStateRequest) (*emptypb.Empty, error) {
	actorID, err := actorFromContext(ctx)
	if err != nil {
		return nil, err
	}
	threadID, err := parseUUID(req.GetThreadId(), "thread_id")
	if err != nil {
		return nil, err
	}
	if err := s.svc.ReopenThread(ctx, actorID, threadID); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func (s *Server) DeleteComment(ctx context.Context, req *commentv1.DeleteCommentRequest) (*emptypb.Empty, error) {
	actorID, err := actorFromContext(ctx)
	if err != nil {
		return nil, err
	}
	commentID, err := parseUUID(req.GetCommentId(), "comment_id")
	if err != nil {
		return nil, err
	}
	if err := s.svc.SoftDeleteComment(ctx, actorID, commentID); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func (s *Server) FollowThread(ctx context.Context, req *commentv1.FollowThreadRequest) (*emptypb.Empty, error) {
	return s.follow(ctx, req.GetThreadId(), true)
}

func (s *Server) UnfollowThread(ctx context.Context, req *commentv1.FollowThreadRequest) (*emptypb.Empty, error) {
	return s.follow(ctx, req.GetThreadId(), false)
}

func (s *Server) follow(ctx context.Context, rawThreadID string, follow bool) (*emptypb.Empty, error) {
	actorID, err := actorFromContext(ctx)
	if err != nil {
		return nil, err
	}
	threadID, err := parseUUID(rawThreadID, "thread_id")
	if err != nil {
		return nil, err
	}
	if err := s.svc.FollowThread(ctx, actorID, threadID, follow); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func actorFromContext(ctx context.Context) (uuid.UUID, error) {
	actorID, ok := authctx.UserID(ctx)
	if !ok || actorID == uuid.Nil {
		return uuid.Nil, status.Error(codes.Unauthenticated, "missing x-user-id metadata")
	}
	return actorID, nil
}

func parseUUID(raw, field string) (uuid.UUID, error) {
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, status.Errorf(codes.InvalidArgument, "invalid %s", field)
	}
	return id, nil
}

func toDomainAnchor(a *commentv1.Anchor) domain.Anchor {
	if a == nil {
		return domain.Anchor{}
	}
	return domain.Anchor{
		Kind:          a.GetKind(),
		BlockID:       a.GetBlockId(),
		StartOffset:   protoInt32ToDomainInt(a.StartOffset),
		EndOffset:     protoInt32ToDomainInt(a.EndOffset),
		SelectedText:  a.GetSelectedText(),
		ContextBefore: a.GetContextBefore(),
		ContextAfter:  a.GetContextAfter(),
		SnapshotID:    a.GetSnapshotId(),
		TableID:       a.GetTableId(),
		RowID:         a.GetRowId(),
		ColumnID:      a.GetColumnId(),
	}
}

func toDomainBody(nodes []*commentv1.BodyNode) domain.CommentBody {
	out := make(domain.CommentBody, 0, len(nodes))
	for _, node := range nodes {
		if node == nil {
			continue
		}
		item := domain.BodyNode{Type: node.GetType(), Text: node.GetText(), Label: node.GetLabel()}
		if node.GetUserId() != "" {
			userID := uuid.MustParse(node.GetUserId())
			item.UserID = &userID
		}
		out = append(out, item)
	}
	return out
}

func toProtoThread(thread domain.Thread) *commentv1.Thread {
	msg := &commentv1.Thread{
		Id:              thread.ID.String(),
		PageId:          thread.PageID.String(),
		Anchor:          toProtoAnchor(thread.Anchor),
		AnchorHash:      thread.AnchorHash,
		CreatedBy:       thread.CreatedBy.String(),
		Status:          thread.Status,
		CreatedAt:       timestamppb.New(thread.CreatedAt),
		UpdatedAt:       timestamppb.New(thread.UpdatedAt),
		ResolvedAt:      tsPtr(thread.ResolvedAt),
		LastCommentedAt: tsPtr(thread.LastCommentedAt),
		CommentsCount:   int32(thread.CommentsCount),
	}
	if thread.ResolvedBy != nil {
		value := thread.ResolvedBy.String()
		msg.ResolvedBy = &value
	}
	return msg
}

func toProtoComment(comment domain.Comment) *commentv1.Comment {
	msg := &commentv1.Comment{
		Id:        comment.ID.String(),
		ThreadId:  comment.ThreadID.String(),
		AuthorId:  comment.AuthorID.String(),
		Body:      toProtoBody(comment.Body),
		BodyText:  comment.BodyText,
		CreatedAt: timestamppb.New(comment.CreatedAt),
		UpdatedAt: timestamppb.New(comment.UpdatedAt),
		EditedAt:  tsPtr(comment.EditedAt),
		DeletedAt: tsPtr(comment.DeletedAt),
		Status:    comment.Status,
	}
	if comment.ParentCommentID != nil {
		value := comment.ParentCommentID.String()
		msg.ParentCommentId = &value
	}
	return msg
}

func toProtoAnchor(anchor domain.Anchor) *commentv1.Anchor {
	return &commentv1.Anchor{
		Kind:          anchor.Kind,
		BlockId:       anchor.BlockID,
		StartOffset:   domainIntToProtoInt32(anchor.StartOffset),
		EndOffset:     domainIntToProtoInt32(anchor.EndOffset),
		SelectedText:  anchor.SelectedText,
		ContextBefore: anchor.ContextBefore,
		ContextAfter:  anchor.ContextAfter,
		SnapshotId:    anchor.SnapshotID,
		TableId:       anchor.TableID,
		RowId:         anchor.RowID,
		ColumnId:      anchor.ColumnID,
	}
}

func toProtoBody(body domain.CommentBody) []*commentv1.BodyNode {
	out := make([]*commentv1.BodyNode, 0, len(body))
	for _, node := range body {
		item := &commentv1.BodyNode{Type: node.Type, Text: node.Text, Label: node.Label}
		if node.UserID != nil {
			item.UserId = node.UserID.String()
		}
		out = append(out, item)
	}
	return out
}

func protoInt32ToDomainInt(v *int32) *int {
	if v == nil {
		return nil
	}
	value := int(*v)
	return &value
}

func domainIntToProtoInt32(v *int) *int32 {
	if v == nil {
		return nil
	}
	value := int32(*v)
	return &value
}

func tsPtr(t *time.Time) *timestamppb.Timestamp {
	if t == nil {
		return nil
	}
	return timestamppb.New(*t)
}
