package config

import (
	"fmt"
	"os"
)

type GRPCConfig struct {
	Port string
}

type HTTPConfig struct {
	Port string
}

type DBConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

func (c DBConfig) URL() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s", c.User, c.Password, c.Host, c.Port, c.Name, c.SSLMode)
}

type JWTConfig struct {
	Issuer        string
	Audience      string
	PublicKeyPath string
}

type Config struct {
	GRPC GRPCConfig
	HTTP HTTPConfig
	DB   DBConfig
	JWT  JWTConfig
}

func Default() Config {
	return Config{
		GRPC: GRPCConfig{
			Port: "50051",
		},
		HTTP: HTTPConfig{
			Port: "8080",
		},
		DB: DBConfig{
			Host:     "localhost",
			Port:     "5432",
			User:     "postgres",
			Password: "postgres",
			Name:     "pages",
			SSLMode:  "disable",
		},
	}
}

func MustLoad() Config {
	cfg := Default()

	if value, ok := os.LookupEnv("GRPC_PORT"); ok {
		cfg.GRPC.Port = value
	}
	if value, ok := os.LookupEnv("HTTP_PORT"); ok {
		cfg.HTTP.Port = value
	}
	if value, ok := os.LookupEnv("DB_HOST"); ok {
		cfg.DB.Host = value
	}
	if value, ok := os.LookupEnv("DB_PORT"); ok {
		cfg.DB.Port = value
	}
	if value, ok := os.LookupEnv("DB_USER"); ok {
		cfg.DB.User = value
	}
	if value, ok := os.LookupEnv("DB_PASSWORD"); ok {
		cfg.DB.Password = value
	}
	if value, ok := os.LookupEnv("DB_NAME"); ok {
		cfg.DB.Name = value
	}
	if value, ok := os.LookupEnv("DB_SSLMODE"); ok {
		cfg.DB.SSLMode = value
	}
	if value, ok := os.LookupEnv("JWT_ISSUER"); ok {
		cfg.JWT.Issuer = value
	}
	if value, ok := os.LookupEnv("JWT_AUDIENCE"); ok {
		cfg.JWT.Audience = value
	}
	if value, ok := os.LookupEnv("JWT_PUBLIC_KEY_PEM"); ok {
		cfg.JWT.PublicKeyPath = value
	}

	return cfg
}
