package broker

import (
	"context"
	"encoding/json"
	"fmt"

	amqp "github.com/rabbitmq/amqp091-go"
)

type Publisher interface {
	Publish(ctx context.Context, routingKey string, msg any) error
	Close() error
}

type Consumer interface {
	Consume(ctx context.Context, queue string, handler func(context.Context, amqp.Delivery) error) error
	Close() error
}

type RabbitMQ struct {
	conn     *amqp.Connection
	channel  *amqp.Channel
	exchange string
}

func NewRabbitMQ(url, exchange string) (*RabbitMQ, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, err
	}
	ch, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		return nil, err
	}
	if err := ch.ExchangeDeclare(exchange, "topic", true, false, false, false, nil); err != nil {
		_ = ch.Close()
		_ = conn.Close()
		return nil, err
	}
	return &RabbitMQ{conn: conn, channel: ch, exchange: exchange}, nil
}

func (r *RabbitMQ) DeclareAndBind(queue string, keys []string) error {
	if _, err := r.channel.QueueDeclare(queue, true, false, false, false, nil); err != nil {
		return err
	}
	for _, key := range keys {
		if err := r.channel.QueueBind(queue, key, r.exchange, false, nil); err != nil {
			return fmt.Errorf("bind %s: %w", key, err)
		}
	}
	return nil
}

func (r *RabbitMQ) Publish(ctx context.Context, routingKey string, msg any) error {
	payload, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return r.channel.PublishWithContext(ctx, r.exchange, routingKey, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Body:         payload,
	})
}

func (r *RabbitMQ) Consume(ctx context.Context, queue string, handler func(context.Context, amqp.Delivery) error) error {
	deliveries, err := r.channel.Consume(queue, "", false, false, false, false, nil)
	if err != nil {
		return err
	}
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case delivery, ok := <-deliveries:
			if !ok {
				return nil
			}
			if err := handler(ctx, delivery); err != nil {
				_ = delivery.Nack(false, true)
				continue
			}
			_ = delivery.Ack(false)
		}
	}
}

func (r *RabbitMQ) Close() error {
	if r.channel != nil {
		_ = r.channel.Close()
	}
	if r.conn != nil {
		return r.conn.Close()
	}
	return nil
}
