package producer

import (
	"context"

	"github.com/redkindanil/flow-note/common/events"
)

type Publisher interface {
	Publish(ctx context.Context, envelope events.Envelope) error
}

