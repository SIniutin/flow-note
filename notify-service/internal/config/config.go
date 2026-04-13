package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	ServiceName    string
	GRPCPort       string
	PostgresDSN    string
	BrokerURL      string
	BrokerExchange string
	BrokerQueue    string
	RedisAddr      string
	LogLevel       string
	ConsumerWait   time.Duration
}

func Load() Config {
	return Config{
		ServiceName:    env("NOTIFY_SERVICE_NAME", "notify-service"),
		GRPCPort:       env("NOTIFY_GRPC_PORT", "9092"),
		PostgresDSN:    env("NOTIFY_POSTGRES_DSN", "postgres://notify:notify@localhost:5434/notifydb?sslmode=disable"),
		BrokerURL:      env("BROKER_URL", "amqp://guest:guest@localhost:5672/"),
		BrokerExchange: env("BROKER_EXCHANGE", "flow.events"),
		BrokerQueue:    env("NOTIFY_BROKER_QUEUE", "notify-service.events"),
		RedisAddr:      env("REDIS_ADDR", "localhost:6379"),
		LogLevel:       env("LOG_LEVEL", "info"),
		ConsumerWait:   envDuration("NOTIFY_CONSUMER_WAIT", 3*time.Second),
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}
