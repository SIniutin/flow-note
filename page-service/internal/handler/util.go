package handler

import (
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

func mustParseUUID(raw string) uuid.UUID {
	return uuid.MustParse(raw)
}

func (h *pagesHandler) logIn(method string, fields ...zap.Field) {
	if h.logger == nil {
		return
	}
	h.logger.Info("handler input", append([]zap.Field{zap.String("method", method)}, fields...)...)
}

func (h *pagesHandler) logOut(method string, startedAt time.Time, fields ...zap.Field) {
	if h.logger == nil {
		return
	}
	base := []zap.Field{
		zap.String("method", method),
		zap.Duration("duration", time.Since(startedAt)),
	}
	h.logger.Info("handler output", append(base, fields...)...)
}

func (h *pagesHandler) logWarn(method string, startedAt time.Time, err error, fields ...zap.Field) {
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
