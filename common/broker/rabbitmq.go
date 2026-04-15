package broker

import (
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
	entity_id string    `json:entity_id`
	page_id   string    `json:page_id`
	Type      EventType `json:type`
}

type RabbitMQ struct {
	conn     *amqp.Connection
	ch       *amqp.Channel
	exchange string
}

func NewRabbitMQ(url, exchange string) (*RabbitMQ, error) {
	conn, err := amqp.Dial(url)
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

func (r *RabbitMQ) Close() error {
	if r.ch != nil {
		_ = r.ch.Close()
	}
	if r.conn != nil {
		return r.conn.Close()
	}
	return nil
}
