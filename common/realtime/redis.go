package realtime

import (
	"context"
	"encoding/json"

	"github.com/redis/go-redis/v9"
)

type Publisher interface {
	PublishUser(ctx context.Context, userChannel string, payload any) error
	Close() error
}

type Subscriber interface {
	SubscribeUser(ctx context.Context, userChannel string) (<-chan []byte, error)
	Close() error
}

type RedisPublisher struct {
	client *redis.Client
}

func NewRedisPublisher(addr string) *RedisPublisher {
	return &RedisPublisher{
		client: redis.NewClient(&redis.Options{Addr: addr}),
	}
}

func (p *RedisPublisher) PublishUser(ctx context.Context, userChannel string, payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return p.client.Publish(ctx, userChannel, body).Err()
}

func (p *RedisPublisher) Close() error {
	return p.client.Close()
}

func (p *RedisPublisher) SubscribeUser(ctx context.Context, userChannel string) (<-chan []byte, error) {
	pubsub := p.client.Subscribe(ctx, userChannel)
	if _, err := pubsub.Receive(ctx); err != nil {
		_ = pubsub.Close()
		return nil, err
	}
	out := make(chan []byte)
	go func() {
		defer close(out)
		defer pubsub.Close()
		ch := pubsub.Channel()
		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}
				select {
				case out <- []byte(msg.Payload):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}
