package runtime

import (
	"context"

	"go.uber.org/zap"
)

// LoggerWithContext attaches request/trace IDs from context if present.
func LoggerWithContext(logger *zap.Logger, ctx context.Context) *zap.Logger {
	if logger == nil {
		logger = zap.NewNop()
	}

	fields := make([]zap.Field, 0, 2)
	if requestID, ok := RequestIDFromContext(ctx); ok {
		fields = append(fields, zap.String("request_id", requestID))
	}
	if traceID, ok := TraceIDFromContext(ctx); ok {
		fields = append(fields, zap.String("trace_id", traceID))
	}
	if len(fields) == 0 {
		return logger
	}
	return logger.With(fields...)
}
