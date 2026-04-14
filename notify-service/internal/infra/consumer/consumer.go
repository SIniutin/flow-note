package consumer

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/flow-note/common/broker"
	"github.com/flow-note/common/events"
	amqp "github.com/rabbitmq/amqp091-go"
)

// eventProcessor is the inbound port consumed by the AMQP adapter.
type eventProcessor interface {
	Execute(ctx context.Context, envelope events.Envelope) error
}

// Consumer is the AMQP inbound adapter.
// It subscribes to a queue, deserialises domain events, and delegates to the
// ProcessEvent use case.
type Consumer struct {
	broker    broker.Consumer
	queue     string
	processor eventProcessor
}

func New(b broker.Consumer, queue string, processor eventProcessor) *Consumer {
	return &Consumer{broker: b, queue: queue, processor: processor}
}

// Run blocks until ctx is cancelled or the broker returns an error.
func (c *Consumer) Run(ctx context.Context) error {
	return c.broker.Consume(ctx, c.queue, func(ctx context.Context, d amqp.Delivery) error {
		var envelope events.Envelope
		if err := json.Unmarshal(d.Body, &envelope); err != nil {
			return fmt.Errorf("malformed event body: %w", err)
		}
		return c.processor.Execute(ctx, envelope)
	})
}
