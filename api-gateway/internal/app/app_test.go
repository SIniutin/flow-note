package app

import (
	"bufio"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	authpb "github.com/flow-note/api-contracts/generated/proto/auth/v1"
	collabpb "github.com/flow-note/api-contracts/generated/proto/collab/v1"
	commentpb "github.com/flow-note/api-contracts/generated/proto/comment/v1"
	mediapb "github.com/flow-note/api-contracts/generated/proto/media/v1"
	notifypb "github.com/flow-note/api-contracts/generated/proto/notify/v1"
	sec "github.com/flow-note/common/authsecurity"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/emptypb"
)

type fakeAuthServer struct {
	authpb.UnimplementedAuthServiceServer
}

type fakeCollabTableServer struct {
	collabpb.UnimplementedCollabTableServiceServer
}

type fakeCommentServer struct {
	commentpb.UnimplementedCommentServiceServer
}

type fakeMediaServer struct {
	mediapb.UnimplementedMediaServiceServer
}

type fakeNotifyServer struct {
	notifypb.UnimplementedNotificationServiceServer
}

func (s *fakeAuthServer) Login(ctx context.Context, req *authpb.LoginRequest) (*authpb.AuthResponse, error) {
	return &authpb.AuthResponse{
		User: &authpb.User{Id: "1", Email: "user@example.com", Login: "user"},
		Tokens: &authpb.TokenPair{
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
		},
	}, nil
}

func (s *fakeAuthServer) Register(ctx context.Context, req *authpb.RegisterRequest) (*authpb.AuthResponse, error) {
	return &authpb.AuthResponse{
		User: &authpb.User{Id: "1", Email: req.GetEmail(), Login: req.GetLogin()},
		Tokens: &authpb.TokenPair{
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
		},
	}, nil
}

func (s *fakeAuthServer) Refresh(ctx context.Context, req *authpb.RefreshRequest) (*authpb.TokenPair, error) {
	return &authpb.TokenPair{AccessToken: "access-token", RefreshToken: "refresh-token"}, nil
}

func (s *fakeAuthServer) Logout(ctx context.Context, req *authpb.LogoutRequest) (*emptypb.Empty, error) {
	return &emptypb.Empty{}, nil
}

func (s *fakeCollabTableServer) GetTable(ctx context.Context, req *collabpb.GetTableRequest) (*collabpb.GetTableResponse, error) {
	return &collabpb.GetTableResponse{DstId: req.GetDstId()}, nil
}

func (s *fakeCollabTableServer) ListTableViews(ctx context.Context, req *collabpb.ListTableViewsRequest) (*collabpb.ListTableViewsResponse, error) {
	return &collabpb.ListTableViewsResponse{DstId: req.GetDstId()}, nil
}

func (s *fakeCollabTableServer) GetTableView(ctx context.Context, req *collabpb.GetTableViewRequest) (*collabpb.GetTableViewResponse, error) {
	return &collabpb.GetTableViewResponse{
		DstId:  req.GetDstId(),
		ViewId: req.GetViewId(),
	}, nil
}

func (s *fakeCommentServer) MakeComment(ctx context.Context, req *commentpb.CreateCommentRequest) (*commentpb.CreateCommentResponce, error) {
	return &commentpb.CreateCommentResponce{
		Comment: &commentpb.Comment{
			Id:     "comment-1",
			UserId: req.GetUserId(),
			PageId: req.GetPageId(),
			Body:   req.GetBody(),
		},
	}, nil
}

func (s *fakeCommentServer) SubscribeToComment(ctx context.Context, req *commentpb.SubscribeToCommentRequest) (*emptypb.Empty, error) {
	return &emptypb.Empty{}, nil
}

func (s *fakeCommentServer) UnsubscribeToComment(ctx context.Context, req *commentpb.UnsubscribeToCommentRequest) (*emptypb.Empty, error) {
	return &emptypb.Empty{}, nil
}

func (s *fakeCommentServer) ListComments(ctx context.Context, req *commentpb.ListCommentsRequest) (*commentpb.ListCommentsResponse, error) {
	return &commentpb.ListCommentsResponse{}, nil
}

func (s *fakeCommentServer) GetComment(ctx context.Context, req *commentpb.GetCommentRequest) (*commentpb.GetCommentResponce, error) {
	return &commentpb.GetCommentResponce{
		Comment: &commentpb.Comment{Id: req.GetCommentId()},
	}, nil
}

func (s *fakeMediaServer) GetLatestSnapshotDownloadUrl(ctx context.Context, req *mediapb.GetLatestSnapshotDownloadUrlRequest) (*mediapb.GetLatestSnapshotDownloadUrlResponse, error) {
	return &mediapb.GetLatestSnapshotDownloadUrlResponse{DownloadUrl: "http://example.com/latest"}, nil
}

func (s *fakeMediaServer) GetSnapshotDownloadUrl(ctx context.Context, req *mediapb.GetSnapshotDownloadUrlRequest) (*mediapb.GetSnapshotDownloadUrlResponse, error) {
	return &mediapb.GetSnapshotDownloadUrlResponse{DownloadUrl: "http://example.com/snapshot"}, nil
}

func (s *fakeMediaServer) GetMediaDownloadUrl(ctx context.Context, req *mediapb.GetMediaDownloadUrlRequest) (*mediapb.GetMediaDownloadUrlResponse, error) {
	return &mediapb.GetMediaDownloadUrlResponse{DownloadUrl: "http://example.com/media"}, nil
}

func (s *fakeMediaServer) GetMediaUploadUrl(ctx context.Context, req *mediapb.GetMediaUploadUrlRequest) (*mediapb.GetMediaUploadUrlResponse, error) {
	return &mediapb.GetMediaUploadUrlResponse{UploadUrl: "http://example.com/upload", MediaId: "media-1"}, nil
}

func (s *fakeNotifyServer) StreamNotification(_ *emptypb.Empty, stream grpc.ServerStreamingServer[notifypb.Notification]) error {
	return stream.Send(&notifypb.Notification{
		Id:     "notification-1",
		UserId: "11111111-1111-1111-1111-111111111111",
		Type:   notifypb.NotificationType_NOTIFICATION_TYPE_MENTION_PAGE,
		Payload: &notifypb.NotificationPayload{
			PageId: "22222222-2222-2222-2222-222222222222",
		},
	})
}

func TestRunServesHealthAndProxiesAuth(t *testing.T) {
	authAddr := startAuthTestGRPCServer(t)
	collabAddr := startCollabTestGRPCServer(t)
	commentAddr := startCommentTestGRPCServer(t)
	mediaAddr := startMediaTestGRPCServer(t)
	notifyAddr := startNotifyTestGRPCServer(t)
	keyPath, _ := createGatewayTestKeyPair(t)
	httpAddr := freeTCPAddr(t)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	a := New(Config{
		HTTPAddr:        httpAddr,
		AuthGRPCAddr:    authAddr,
		CollabGRPCAddr:  collabAddr,
		CommentGRPCAddr: commentAddr,
		MediaGRPCAddr:   mediaAddr,
		NotifyGRPCAddr:  notifyAddr,
		CollabAddr:      "127.0.0.1:4000",
		PublicKeyPath:   keyPath,
		JWTIssuer:       "todo-auth",
		JWTAudience:     "todo-api",
	})

	errCh := make(chan error, 1)
	go func() {
		errCh <- a.Run(ctx)
	}()

	waitForHTTP(t, "http://"+httpAddr+"/healthz")

	resp, err := http.Get("http://" + httpAddr + "/healthz")
	if err != nil {
		t.Fatalf("health request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	_ = resp.Body.Close()

	resp, err = http.Post(
		"http://"+httpAddr+"/v1/auth/login",
		"application/json",
		strings.NewReader(`{"email":"user@example.com","password":"secret"}`),
	)
	if err != nil {
		t.Fatalf("login request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var authBody map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&authBody); err != nil {
		t.Fatalf("decode login response: %v", err)
	}
	_ = resp.Body.Close()
	if authBody["user"] == nil {
		t.Fatal("expected user field in auth response")
	}

	cancel()
	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("gateway run: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("gateway did not stop in time")
	}
}

func TestRunStreamsNotificationsAsSSE(t *testing.T) {
	authAddr := startAuthTestGRPCServer(t)
	collabAddr := startCollabTestGRPCServer(t)
	commentAddr := startCommentTestGRPCServer(t)
	mediaAddr := startMediaTestGRPCServer(t)
	notifyAddr := startNotifyTestGRPCServer(t)
	keyPath, token := createGatewayTestKeyPair(t)
	httpAddr := freeTCPAddr(t)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	a := New(Config{
		HTTPAddr:        httpAddr,
		AuthGRPCAddr:    authAddr,
		CollabGRPCAddr:  collabAddr,
		CommentGRPCAddr: commentAddr,
		MediaGRPCAddr:   mediaAddr,
		NotifyGRPCAddr:  notifyAddr,
		CollabAddr:      "127.0.0.1:4000",
		PublicKeyPath:   keyPath,
		JWTIssuer:       "todo-auth",
		JWTAudience:     "todo-api",
	})

	errCh := make(chan error, 1)
	go func() {
		errCh <- a.Run(ctx)
	}()

	waitForHTTP(t, "http://"+httpAddr+"/healthz")

	req, err := http.NewRequest(http.MethodGet, "http://"+httpAddr+"/v1/notifications/stream", nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("stream request: %v", err)
	}
	defer resp.Body.Close()

	if got := resp.Header.Get("Content-Type"); !strings.Contains(got, "text/event-stream") {
		t.Fatalf("expected sse content-type, got %q", got)
	}

	reader := bufio.NewReader(resp.Body)
	body, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read stream body: %v", err)
	}
	text := string(body)
	if !strings.Contains(text, "event: notification") {
		t.Fatalf("expected notification event, got %q", text)
	}
	if !strings.Contains(text, "\"id\":\"notification-1\"") {
		t.Fatalf("expected notification payload, got %q", text)
	}

	cancel()
	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("gateway run: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("gateway did not stop in time")
	}
}

func startAuthTestGRPCServer(t *testing.T) string {
	t.Helper()
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		skipIfListenForbidden(t, err)
		t.Fatalf("listen auth grpc: %v", err)
	}
	srv := grpc.NewServer()
	authpb.RegisterAuthServiceServer(srv, &fakeAuthServer{})
	go func() { _ = srv.Serve(lis) }()
	t.Cleanup(srv.Stop)
	return lis.Addr().String()
}

func startCollabTestGRPCServer(t *testing.T) string {
	t.Helper()
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		skipIfListenForbidden(t, err)
		t.Fatalf("listen collab grpc: %v", err)
	}
	srv := grpc.NewServer()
	collabpb.RegisterCollabTableServiceServer(srv, &fakeCollabTableServer{})
	go func() { _ = srv.Serve(lis) }()
	t.Cleanup(srv.Stop)
	return lis.Addr().String()
}

func startCommentTestGRPCServer(t *testing.T) string {
	t.Helper()
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		skipIfListenForbidden(t, err)
		t.Fatalf("listen comment grpc: %v", err)
	}
	srv := grpc.NewServer()
	commentpb.RegisterCommentServiceServer(srv, &fakeCommentServer{})
	go func() { _ = srv.Serve(lis) }()
	t.Cleanup(srv.Stop)
	return lis.Addr().String()
}

func startMediaTestGRPCServer(t *testing.T) string {
	t.Helper()
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		skipIfListenForbidden(t, err)
		t.Fatalf("listen media grpc: %v", err)
	}
	srv := grpc.NewServer()
	mediapb.RegisterMediaServiceServer(srv, &fakeMediaServer{})
	go func() { _ = srv.Serve(lis) }()
	t.Cleanup(srv.Stop)
	return lis.Addr().String()
}

func startNotifyTestGRPCServer(t *testing.T) string {
	t.Helper()
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		skipIfListenForbidden(t, err)
		t.Fatalf("listen notify grpc: %v", err)
	}
	srv := grpc.NewServer()
	notifypb.RegisterNotificationServiceServer(srv, &fakeNotifyServer{})
	go func() { _ = srv.Serve(lis) }()
	t.Cleanup(srv.Stop)
	return lis.Addr().String()
}

func createGatewayTestKeyPair(t *testing.T) (string, string) {
	t.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate rsa key: %v", err)
	}

	pubDER, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		t.Fatalf("marshal public key: %v", err)
	}

	pubPath := filepath.Join(t.TempDir(), "public.pem")
	pubPEM := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubDER})
	if err := os.WriteFile(pubPath, pubPEM, 0o600); err != nil {
		t.Fatalf("write public key: %v", err)
	}

	issuer := sec.NewRS256Issuer(key, "todo-auth", "todo-api", 15*time.Minute, "k1")
	token, _, err := issuer.NewAccess("11111111-1111-1111-1111-111111111111")
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}

	return pubPath, token
}

func freeTCPAddr(t *testing.T) string {
	t.Helper()
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		skipIfListenForbidden(t, err)
		t.Fatalf("reserve tcp addr: %v", err)
	}
	addr := lis.Addr().String()
	_ = lis.Close()
	return addr
}

func waitForHTTP(t *testing.T, url string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		resp, err := http.Get(url)
		if err == nil {
			_ = resp.Body.Close()
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatalf("http server did not start: %s", url)
}

func skipIfListenForbidden(t *testing.T, err error) {
	t.Helper()
	if errors.Is(err, os.ErrPermission) || strings.Contains(err.Error(), "operation not permitted") {
		t.Skipf("listen not permitted in this environment: %v", err)
	}
}
