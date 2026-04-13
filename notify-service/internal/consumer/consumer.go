package consumer

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/flow-note/common/broker"
	"github.com/flow-note/common/events"
	"github.com/flow-note/notify-service/internal/service"
	amqp "github.com/rabbitmq/amqp091-go"
)

type Consumer struct {
	broker broker.Consumer
	queue  string
	svc    *service.Service
}

func New(broker broker.Consumer, queue string, svc *service.Service) *Consumer {
	return &Consumer{broker: broker, queue: queue, svc: svc}
}

func (c *Consumer) Run(ctx context.Context) error {
	return c.broker.Consume(ctx, c.queue, func(ctx context.Context, d amqp.Delivery) error {
		var envelope events.Envelope
		if err := json.Unmarshal(d.Body, &envelope); err != nil {
			return fmt.Errorf("malformed event body: %w", err)
		}
		return c.svc.ProcessEvent(ctx, envelope)
	})
}
