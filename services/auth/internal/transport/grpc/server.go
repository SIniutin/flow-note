package grpc

import (
	"context"
	"errors"
	"fmt"

	d "github.com/flow-note/auth-service/internal/domain"
	uc "github.com/flow-note/auth-service/internal/usecase"
	"github.com/google/uuid"

	pb "github.com/flow-note/api-contracts/generated/proto/auth/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

type Server struct {
	pb.UnimplementedAuthServiceServer

	login     *uc.LoginUser
	logout    *uc.LogoutUser
	refresh   *uc.RefreshUser
	register  *uc.RegisterUser
	getByID   *uc.GetUserById
	getByName *uc.GetUserByName
}

func NewServer(
	reg *uc.RegisterUser,
	login *uc.LoginUser,
	ref *uc.RefreshUser,
	logout *uc.LogoutUser,
	getByID *uc.GetUserById,
	getByName *uc.GetUserByName,
) *Server {
	return &Server{
		login:     login,
		logout:    logout,
		refresh:   ref,
		register:  reg,
		getByID:   getByID,
		getByName: getByName,
	}
}

func toPBUser(u d.User) *pb.User {
	return &pb.User{
		Id:    u.ID.String(),
		Email: string(u.Email),
		Login: string(u.Login),
	}
}

func toPBTokenPair(p d.TokenPair) *pb.TokenPair {
	return &pb.TokenPair{
		RefreshToken: p.RefreshToken,
		AccessToken:  p.AccessToken,
	}
}

func (s *Server) Register(ctx context.Context, req *pb.RegisterRequest) (*pb.AuthResponse, error) {
	req.ValidateAll()

	user, tokens, err := s.register.Exec(ctx, d.UserCreateRequest{
		Email: req.GetEmail(),
		Login: req.GetLogin(),
	}, req.GetPassword())
	if err != nil {
		return nil, mapErr(err)
	}

	return &pb.AuthResponse{
		User:   toPBUser(user),
		Tokens: toPBTokenPair(tokens),
	}, nil
}

func (s *Server) Login(ctx context.Context, req *pb.LoginRequest) (*pb.AuthResponse, error) {
	req.ValidateAll()

	user, tokens, err := s.login.Exec(ctx, &d.UserLoginRequest{
		Email:    req.GetEmail(),
		Login:    req.GetLogin(),
		Password: req.GetPassword(),
	})
	if err != nil {
		return nil, mapErr(err)
	}

	return &pb.AuthResponse{
		User:   toPBUser(user),
		Tokens: toPBTokenPair(tokens),
	}, nil
}

func (s *Server) Refresh(ctx context.Context, req *pb.RefreshRequest) (*pb.TokenPair, error) {
	req.ValidateAll()

	tokens, err := s.refresh.Exec(ctx, req.GetRefreshToken())
	if err != nil {
		return nil, mapErr(err)
	}

	return toPBTokenPair(tokens), nil
}

func (s *Server) Logout(ctx context.Context, req *pb.LogoutRequest) (*emptypb.Empty, error) {
	req.ValidateAll()

	if err := s.logout.Exec(ctx, req.GetRefreshToken()); err != nil {
		return nil, mapErr(err)
	}

	return &emptypb.Empty{}, nil
}

func (s *Server) GetById(ctx context.Context, req *pb.GetByIdRequest) (*pb.GetByIdResponse, error) {
	req.ValidateAll()

	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid uuid")
	}

	user, err := s.getByID.Exec(ctx, d.UserID(id))
	if err != nil {
		return nil, mapErr(err)
	}

	return &pb.GetByIdResponse{User: toPBUser(user)}, nil
}

func (s *Server) GetByName(ctx context.Context, req *pb.GetByNameRequest) (*pb.GetByNameResponse, error) {
	req.ValidateAll()

	login, err := d.NewLogin(req.GetLogin())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid login")
	}

	user, err := s.getByName.Exec(ctx, *login)
	if err != nil {
		return nil, mapErr(err)
	}

	return &pb.GetByNameResponse{User: toPBUser(user)}, nil
}

func mapErr(err error) error {
	print := func(c codes.Code, e error) error {
		return status.Error(c, fmt.Sprintf("authorization failed: %v", err))
	}
	switch {
	case errors.Is(err, d.ErrNotFound):
		return print(codes.NotFound, err)
	case errors.Is(err, d.ErrConflict):
		return print(codes.AlreadyExists, err)
	case errors.Is(err, d.ErrUnauthorized):
		return print(codes.Unauthenticated, err)
	case errors.Is(err, d.ErrValidation):
		return print(codes.InvalidArgument, err)
	default:
		return status.Error(codes.Internal, fmt.Sprintf("internal error: %v", err))
	}
}
