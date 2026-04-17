package runtime

import "context"

type ctxKey int

const (
	ctxKeyRequestID ctxKey = iota + 1
	ctxKeyTraceID
)

func WithRequestID(ctx context.Context, requestID string) context.Context {
	if requestID == "" {
		return ctx
	}
	return context.WithValue(ctx, ctxKeyRequestID, requestID)
}

func RequestIDFromContext(ctx context.Context) (string, bool) {
	v := ctx.Value(ctxKeyRequestID)
	if v == nil {
		return "", false
	}
	s, ok := v.(string)
	if !ok || s == "" {
		return "", false
	}
	return s, true
}

func WithTraceID(ctx context.Context, traceID string) context.Context {
	if traceID == "" {
		return ctx
	}
	return context.WithValue(ctx, ctxKeyTraceID, traceID)
}

func TraceIDFromContext(ctx context.Context) (string, bool) {
	v := ctx.Value(ctxKeyTraceID)
	if v == nil {
		return "", false
	}
	s, ok := v.(string)
	if !ok || s == "" {
		return "", false
	}
	return s, true
}
