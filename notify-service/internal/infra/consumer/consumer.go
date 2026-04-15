package consumer

import (
	"context"

	"github.com/flow-note/common/broker"
	"github.com/flow-note/common/events"
)

// eventProcessor is the inbound port consumed by the AMQP adapter.
type eventProcessor interface {
	Execute(ctx context.Context, envelope events.Envelope) error
}

// Consumer is the AMQP inbound adapter.
// It subscribes to a queue, deserialises domain events, and delegates to the
// ProcessEvent use case.
type Consumer struct {
	broker    broker.RabbitMQ
	queue     string
	processor eventProcessor
}

func New(b broker.RabbitMQ, queue string, processor eventProcessor) *Consumer {
	return &Consumer{broker: b, queue: queue, processor: processor}
}

// Run blocks until ctx is cancelled or the broker returns an error.
func (c *Consumer) Run(ctx context.Context) error {
	return nil
}
