package consumer

import (
	"context"
	"encoding/json"

	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/redkindanil/flow-note/common/broker"
	"github.com/redkindanil/flow-note/common/events"
	"github.com/redkindanil/flow-note/notify-service/internal/service"
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
			return nil
		}
		return c.svc.ProcessEvent(ctx, envelope)
	})
}
