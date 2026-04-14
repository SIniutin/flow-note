package runtime

import "go.uber.org/zap"

// Factory for Zap Logger, returns  (logger, recovery func, error)
func NewLogger() (*zap.Logger, func(), error) {
	cfg := zap.NewProductionConfig()
	logger, err := cfg.Build()
	if err != nil {
		return nil, nil, err
	}
	cleanup := func() {
		_ = logger.Sync()
	}
	return logger, cleanup, nil
}
