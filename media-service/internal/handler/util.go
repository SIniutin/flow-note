package handler

import (
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

func mustParseUUID(raw string) uuid.UUID {
	return uuid.MustParse(raw)
}

func (h *mediaHandler) logWarn(method string, startedAt time.Time, err error, fields ...zap.Field) {
	if h.logger == nil {
		return
	}
	base := []zap.Field{
		zap.String("method", method),
		zap.Duration("duration", time.Since(startedAt)),
		zap.Error(err),
	}
	h.logger.Warn("handler error", append(base, fields...)...)
}
