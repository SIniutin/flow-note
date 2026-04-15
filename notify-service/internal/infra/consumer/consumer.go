package consumer

import (
	"context"
	"encoding/json"

	"github.com/flow-note/common/broker"
	"github.com/google/uuid"
	amqp "github.com/rabbitmq/amqp091-go"
)

// eventProcessor is the inbound port consumed by the AMQP adapter.
type eventProcessor interface {
	Execute(ctx context.Context, eventID uuid.UUID, event broker.Event) error
}

// Consumer is the AMQP inbound adapter.
// It reads pre-established deliveries channel, deserialises domain events,
// and delegates to the ProcessEvent use case.
type Consumer struct {
	msgs      <-chan amqp.Delivery
	processor eventProcessor
}

func New(msgs <-chan amqp.Delivery, processor eventProcessor) *Consumer {
	return &Consumer{msgs: msgs, processor: processor}
}

// Run blocks until ctx is cancelled or the deliveries channel is closed.
func (c *Consumer) Run(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case d, ok := <-c.msgs:
			if !ok {
				return nil
			}
			c.handle(ctx, d)
		}
	}
}

func (c *Consumer) handle(ctx context.Context, d amqp.Delivery) {
	var event broker.Event
	if err := json.Unmarshal(d.Body, &event); err != nil {
		_ = d.Nack(false, false) // discard malformed message
		return
	}

	eventID, err := uuid.Parse(d.MessageId)
	if err != nil {
		eventID = uuid.New()
	}

	if err := c.processor.Execute(ctx, eventID, event); err != nil {
		_ = d.Nack(false, true) // requeue on processing error
		return
	}
	_ = d.Ack(false)
}