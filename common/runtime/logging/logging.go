package logging

import (
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// New builds a production zap.Logger at the requested level.
// level must be one of: debug, info, warn, error. Falls back to info on parse errors.
func New(level string) (*zap.Logger, error) {
	cfg := zap.NewProductionConfig()

	var lvl zapcore.Level
	if err := lvl.UnmarshalText([]byte(level)); err == nil {
		cfg.Level = zap.NewAtomicLevelAt(lvl)
	}

	return cfg.Build()
}
