package producer

import (
	"context"

	"github.com/flow-note/common/events"
)

type Publisher interface {
	Publish(ctx context.Context, envelope events.Envelope) error
}
