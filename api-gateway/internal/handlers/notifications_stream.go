package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	notifypb "github.com/tasker-iniutin/api-gateway/proto/notify/v1"
	"github.com/tasker-iniutin/common/httpauth"
	"google.golang.org/grpc/metadata"
)

type NotificationHandler struct {
	client notifypb.NotifyServiceClient
}

func NewNotificationHandler(client notifypb.NotifyServiceClient) *NotificationHandler {
	return &NotificationHandler{client: client}
}

func (h *NotificationHandler) Stream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	token := httpauth.TokenFromRequest(r)
	if token == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	streamCtx := metadata.NewOutgoingContext(
		r.Context(),
		metadata.Pairs("authorization", "Bearer "+token),
	)

	stream, err := h.client.NotificationStream(streamCtx, &notifypb.NotificationStreamRequest{})
	if err != nil {
		http.Error(w, "failed to open notification stream", http.StatusBadGateway)
		return
	}

	flusher.Flush()

	events := make(chan *notifypb.NotificationEvent, 1)
	errs := make(chan error, 1)

	go func() {
		for {
			event, err := stream.Recv()
			if err != nil {
				errs <- err
				return
			}
			events <- event
		}
	}()

	heartbeat := time.NewTicker(25 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-heartbeat.C:
			_, _ = fmt.Fprint(w, ": ping\n\n")
			flusher.Flush()
		case err := <-errs:
			_ = err
			return
		case event := <-events:
			data, err := json.Marshal(event)
			if err != nil {
				continue
			}

			_, _ = fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}
