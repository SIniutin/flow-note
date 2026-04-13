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
