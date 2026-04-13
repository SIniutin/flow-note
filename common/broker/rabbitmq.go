package broker

import (
	"context"
	"encoding/json"
	"fmt"

	amqp "github.com/rabbitmq/amqp091-go"
)

// Consumer is the interface used by service consumers to read messages.
type Consumer interface {
	Consume(ctx context.Context, queue string, handler func(ctx context.Context, d amqp.Delivery) error) error
}

// RabbitMQ wraps an AMQP connection and channel for a single topic exchange.
type RabbitMQ struct {
	conn     *amqp.Connection
	ch       *amqp.Channel
	exchange string
}

// NewRabbitMQ connects to RabbitMQ and declares a durable topic exchange.
func NewRabbitMQ(url, exchange string) (*RabbitMQ, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("rabbitmq dial: %w", err)
	}
	ch, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("rabbitmq open channel: %w", err)
	}
	if err := ch.ExchangeDeclare(exchange, "topic", true, false, false, false, nil); err != nil {
		_ = ch.Close()
		_ = conn.Close()
		return nil, fmt.Errorf("rabbitmq declare exchange %q: %w", exchange, err)
	}
	return &RabbitMQ{conn: conn, ch: ch, exchange: exchange}, nil
}

// DeclareAndBind declares a durable queue and binds it to the exchange with each routing key.
func (r *RabbitMQ) DeclareAndBind(queue string, routingKeys []string) error {
	if _, err := r.ch.QueueDeclare(queue, true, false, false, false, nil); err != nil {
		return fmt.Errorf("rabbitmq declare queue %q: %w", queue, err)
	}
	for _, key := range routingKeys {
		if err := r.ch.QueueBind(queue, key, r.exchange, false, nil); err != nil {
			return fmt.Errorf("rabbitmq bind queue %q key %q: %w", queue, key, err)
		}
	}
	return nil
}

// Publish serializes data as JSON and publishes it to the exchange with the given routing key.
func (r *RabbitMQ) Publish(ctx context.Context, routingKey string, data any) error {
	body, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("rabbitmq marshal: %w", err)
	}
	return r.ch.PublishWithContext(ctx, r.exchange, routingKey, false, false,
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Body:         body,
		},
	)
}

// Consume starts consuming messages from queue. For each delivery it calls handler:
// if handler returns nil the message is acked; if handler returns an error it is nacked
// (requeue=false so it goes to the dead-letter queue or is discarded).
// Blocks until ctx is cancelled or the channel is closed.
func (r *RabbitMQ) Consume(ctx context.Context, queue string, handler func(ctx context.Context, d amqp.Delivery) error) error {
	deliveries, err := r.ch.Consume(queue, "", false, false, false, false, nil)
	if err != nil {
		return fmt.Errorf("rabbitmq consume %q: %w", queue, err)
	}
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case d, ok := <-deliveries:
			if !ok {
				return fmt.Errorf("rabbitmq channel closed")
			}
			if err := handler(ctx, d); err != nil {
				_ = d.Nack(false, false)
			} else {
				_ = d.Ack(false)
			}
		}
	}
}

func (r *RabbitMQ) Close() error {
	if r.ch != nil {
		_ = r.ch.Close()
	}
	if r.conn != nil {
		return r.conn.Close()
	}
	return nil
}
