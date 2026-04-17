package handlers

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	notifypb "github.com/flow-note/api-contracts/generated/proto/notify/v1"
	"github.com/flow-note/common/httpauth"
	"go.uber.org/zap"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/encoding/protojson"
	emptypb "google.golang.org/protobuf/types/known/emptypb"
)

type NotifySSE struct {
	client notifypb.NotificationServiceClient
	logger *zap.Logger
}

func NewNotifySSE(client notifypb.NotificationServiceClient, logger *zap.Logger) http.Handler {
	return &NotifySSE{client: client, logger: logger}
}

func (h *NotifySSE) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	ctx := r.Context()
	if token := httpauth.ExtractAccessToken(r); token != "" {
		ctx = metadata.NewOutgoingContext(ctx, metadata.Pairs("authorization", "Bearer "+token))
	}

	stream, err := h.client.StreamNotification(ctx, &emptypb.Empty{})
	if err != nil {
		h.logger.Error("failed to open notification stream", zap.Error(err))
		http.Error(w, "notify upstream unavailable", http.StatusBadGateway)
		return
	}

	headers := w.Header()
	headers.Set("Content-Type", "text/event-stream")
	headers.Set("Cache-Control", "no-cache")
	headers.Set("Connection", "keep-alive")
	headers.Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	_, _ = fmt.Fprint(w, ": connected\n\n")
	flusher.Flush()

	marshaler := protojson.MarshalOptions{UseProtoNames: true}

	for {
		msg, err := stream.Recv()
		if err == nil {
			payload, marshalErr := marshaler.Marshal(msg)
			if marshalErr != nil {
				h.logger.Error("failed to marshal notification", zap.Error(marshalErr))
				return
			}

			if _, writeErr := fmt.Fprintf(w, "event: notification\ndata: %s\n\n", payload); writeErr != nil {
				h.logger.Debug("sse client disconnected", zap.Error(writeErr))
				return
			}
			flusher.Flush()
			continue
		}

		if errors.Is(err, io.EOF) || ctx.Err() != nil {
			return
		}

		h.logger.Error("notification stream recv failed", zap.Error(err))
		_, _ = fmt.Fprintf(w, "event: error\ndata: %q\n\n", "stream closed")
		flusher.Flush()
		return
	}
}
