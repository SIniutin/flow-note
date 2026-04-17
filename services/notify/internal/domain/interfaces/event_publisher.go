package port

import "context"

// EventPublisher is the outbound port for real-time user-scoped delivery.
// The channel convention is "notifications:{userID}".
// Implementations live in adapter/redis (or use common/realtime).
type EventPublisher interface {
	PublishUser(ctx context.Context, channel string, payload any) error
}

// EventSubscriber is the outbound port for subscribing to real-time events.
// Used by the gRPC stream handler to push live notifications to connected clients.
type EventSubscriber interface {
	SubscribeUser(ctx context.Context, channel string) (<-chan []byte, error)
}
