package producer

import (
	"context"

	"github.com/flow-note/common/broker"
	"github.com/flow-note/common/events"
)

type Publisher interface {
	Publish(ctx context.Context, envelope events.Envelope) error
}

type directPublisher struct {
	bus *broker.RabbitMQ
}

func NewDirectPublisher(bus *broker.RabbitMQ) *directPublisher {
	return &directPublisher{bus: bus}
}

func (p *directPublisher) Publish(ctx context.Context, envelope events.Envelope) error {
	return p.bus.Publish(ctx, envelope.RoutingKey(), envelope)
}
