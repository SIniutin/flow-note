package grpc

import (
	"context"

	commentv1 "github.com/flow-note/api-contracts/generated/comment/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

type Server struct {
	commentv1.UnimplementedCommentServiceServer
}

func New() *Server {
	return &Server{}
}

func (s *Server) CreateThread(_ context.Context, _ *commentv1.CreateThreadRequest) (*commentv1.CreateThreadResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not implemented")
}

func (s *Server) ListThreads(_ context.Context, _ *commentv1.ListThreadsRequest) (*commentv1.ListThreadsResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not implemented")
}

func (s *Server) ListDiscussions(_ context.Context, _ *commentv1.ListDiscussionsRequest) (*commentv1.ListThreadsResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not implemented")
}

func (s *Server) GetThread(_ context.Context, _ *commentv1.GetThreadRequest) (*commentv1.GetThreadResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not implemented")
}

func (s *Server) AddReply(_ context.Context, _ *commentv1.AddReplyRequest) (*commentv1.AddReplyResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not implemented")
}

func (s *Server) ResolveThread(_ context.Context, _ *commentv1.ChangeThreadStateRequest) (*emptypb.Empty, error) {
	return nil, status.Error(codes.Unimplemented, "not implemented")
}

func (s *Server) ReopenThread(_ context.Context, _ *commentv1.ChangeThreadStateRequest) (*emptypb.Empty, error) {
	return nil, status.Error(codes.Unimplemented, "not implemented")
}

func (s *Server) DeleteComment(_ context.Context, _ *commentv1.DeleteCommentRequest) (*emptypb.Empty, error) {
	return nil, status.Error(codes.Unimplemented, "not implemented")
}

func (s *Server) FollowThread(_ context.Context, _ *commentv1.FollowThreadRequest) (*emptypb.Empty, error) {
	return nil, status.Error(codes.Unimplemented, "not implemented")
}

func (s *Server) UnfollowThread(_ context.Context, _ *commentv1.FollowThreadRequest) (*emptypb.Empty, error) {
	return nil, status.Error(codes.Unimplemented, "not implemented")
}
