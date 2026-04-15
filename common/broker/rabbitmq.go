package broker

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

type EventType string

const (
	EventMentionComment   EventType = "event.mention.comment"
	EventMentionPage      EventType = "event.mention.page"
	EventCommentThread    EventType = "event.mention.thread"
	EventCommentReply     EventType = "event.comment.reply"
	EventCommentMention   EventType = "event.comment.mention"
	EventGrandPermission  EventType = "event.permission.granted"
	EventRevokePermission EventType = "event.permission.revoked"
)

type Event struct {
	UserID   string    `json:"user_id"`
	ActorID  string    `json:"actor_id,omitempty"`
	EntityID string    `json:"entity_id,omitempty"`
	PageID   string    `json:"page_id"`
	Type     EventType `json:"type"`
}

type RabbitMQ struct {
	conn     *amqp.Connection
	ch       *amqp.Channel
	exchange string
}

func NewRabbitMQ(url, exchange string) (*RabbitMQ, error) {
	conn, err := dialWithRetry(url)
	if err != nil {
		return nil, err
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, err
	}

	if err := ch.ExchangeDeclare(exchange, "direct", true, false, false, false, nil); err != nil {
		ch.Close()
		conn.Close()
		return nil, err
	}

	return &RabbitMQ{
		conn:     conn,
		ch:       ch,
		exchange: exchange,
	}, nil
}

func dialWithRetry(url string) (*amqp.Connection, error) {
	var err error
	delay := 250 * time.Millisecond
	for attempt := 0; attempt < 20; attempt++ {
		var conn *amqp.Connection
		conn, err = amqp.Dial(url)
		if err == nil {
			return conn, nil
		}
		time.Sleep(delay)
		if delay < 2*time.Second {
			delay *= 2
		}
	}
	return nil, err
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

func (r *RabbitMQ) Publish(ctx context.Context, event Event) error {
	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}

	return r.ch.PublishWithContext(
		ctx,
		r.exchange,
		string(event.Type),
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Body:         body,
		},
	)
}

func (r *RabbitMQ) DeclareQueueAndBind(queueName string, events ...EventType) (amqp.Queue, error) {
	q, err := r.ch.QueueDeclare(
		queueName,
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return amqp.Queue{}, err
	}

	for _, event := range events {
		if err := r.ch.QueueBind(
			q.Name,
			string(event),
			r.exchange,
			false,
			nil,
		); err != nil {
			return amqp.Queue{}, err
		}
	}

	return q, nil
}

func (r *RabbitMQ) Consume(queueName string) (<-chan amqp.Delivery, error) {
	return r.ch.Consume(
		queueName,
		"",
		false,
		false,
		false,
		false,
		nil,
	)
}
