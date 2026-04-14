package app

import (
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	GRPCAddr         string
	PrivateKeyPath   string
	JWTIssuer        string
	JWTAudience      string
	JWTAccessTTL     time.Duration
	JWTKeyID         string
	EnableReflection bool
	DatabaseURL      string
	RedisAddr        string
	RedisPassword    string
}

func LoadConfig() Config {
	v := viper.New()
	v.AutomaticEnv()

	v.SetDefault("AUTH_GRPC_ADDR", ":50052")
	v.SetDefault("JWT_PRIVATE_KEY_PEM", "")
	v.SetDefault("JWT_ISSUER", "todo-auth")
	v.SetDefault("JWT_AUDIENCE", "todo-api")
	v.SetDefault("JWT_ACCESS_TTL", 15*time.Minute)
	v.SetDefault("JWT_KEY_ID", "k1")
	v.SetDefault("ENABLE_GRPC_REFLECTION", true)
	v.SetDefault("DATABASE_URL", "postgres://postgres:postgres@localhost:5433/auth?sslmode=disable")
	v.SetDefault("REDIS_ADDR", "127.0.0.1:6379")
	v.SetDefault("REDIS_PASSWORD", "")

	return Config{
		GRPCAddr:         v.GetString("AUTH_GRPC_ADDR"),
		PrivateKeyPath:   v.GetString("JWT_PRIVATE_KEY_PEM"),
		JWTIssuer:        v.GetString("JWT_ISSUER"),
		JWTAudience:      v.GetString("JWT_AUDIENCE"),
		JWTAccessTTL:     v.GetDuration("JWT_ACCESS_TTL"),
		JWTKeyID:         v.GetString("JWT_KEY_ID"),
		EnableReflection: v.GetBool("ENABLE_GRPC_REFLECTION"),
		DatabaseURL:      v.GetString("DATABASE_URL"),
		RedisAddr:        v.GetString("REDIS_ADDR"),
		RedisPassword:    v.GetString("REDIS_PASSWORD"),
	}
}
