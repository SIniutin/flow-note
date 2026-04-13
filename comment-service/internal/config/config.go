package config

import (
	"os"
)

type Config struct {
	ServiceName    string
	GRPCPort       string
	HTTPPort       string
	PostgresDSN    string
	BrokerURL      string
	BrokerExchange string
	LogLevel       string
}

func Load() Config {
	return Config{
		ServiceName:    env("COMMENT_SERVICE_NAME", "comment-service"),
		GRPCPort:       env("COMMENT_GRPC_PORT", "9091"),
		HTTPPort:       env("COMMENT_HTTP_PORT", "8081"),
		PostgresDSN:    env("COMMENT_POSTGRES_DSN", "postgres://comment:comment@localhost:5433/commentdb?sslmode=disable"),
		BrokerURL:      env("BROKER_URL", "amqp://guest:guest@localhost:5672/"),
		BrokerExchange: env("BROKER_EXCHANGE", "flow.events"),
		LogLevel:       env("LOG_LEVEL", "info"),
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
