package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Server ServerConfig
	JWT    JWTConfig
	MinIO  MinIOConfig
}

type ServerConfig struct {
	GRPCPort        string
	HTTPPort        string
	ShutdownTimeout time.Duration
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	IdleTimeout     time.Duration
}

type JWTConfig struct {
	Issuer        string
	Audience      string
	PublicKeyPath string
}

type MinIOConfig struct {
	Host       string
	Port       string
	AccessKey  string
	SecretKey  string
	BucketName string
	UseSSL     bool
	URLTTL     time.Duration
}

func Default() Config {
	return Config{
		Server: ServerConfig{
			GRPCPort:        "8081",
			HTTPPort:        "8080",
			ShutdownTimeout: 10 * time.Second,
			ReadTimeout:     5 * time.Second,
			WriteTimeout:    10 * time.Second,
			IdleTimeout:     30 * time.Second,
		},
		MinIO: MinIOConfig{
			Host:       "localhost",
			Port:       "9000",
			AccessKey:  "minioadmin",
			SecretKey:  "minioadmin",
			BucketName: "media",
			UseSSL:     false,
			URLTTL:     15 * time.Minute,
		},
	}
}

func MustParse() Config {
	cfg := Default()

	cfg.Server.GRPCPort = getEnvString("GRPC_PORT", cfg.Server.GRPCPort)
	cfg.Server.HTTPPort = getEnvString("HTTP_PORT", cfg.Server.HTTPPort)
	cfg.Server.ShutdownTimeout = getEnvDuration("SHUTDOWN_TIMEOUT", cfg.Server.ShutdownTimeout)
	cfg.Server.ReadTimeout = getEnvDuration("READ_TIMEOUT", cfg.Server.ReadTimeout)
	cfg.Server.WriteTimeout = getEnvDuration("WRITE_TIMEOUT", cfg.Server.WriteTimeout)
	cfg.Server.IdleTimeout = getEnvDuration("IDLE_TIMEOUT", cfg.Server.IdleTimeout)

	cfg.MinIO.Host = getEnvString("MINIO_HOST", cfg.MinIO.Host)
	cfg.MinIO.Port = getEnvString("MINIO_PORT", cfg.MinIO.Port)
	cfg.MinIO.AccessKey = getEnvString("MINIO_ACCESS_KEY", cfg.MinIO.AccessKey)
	cfg.MinIO.SecretKey = getEnvString("MINIO_SECRET_KEY", cfg.MinIO.SecretKey)
	cfg.MinIO.BucketName = getEnvString("MINIO_BUCKET_NAME", cfg.MinIO.BucketName)
	cfg.MinIO.UseSSL = getEnvBool("MINIO_USE_SSL", cfg.MinIO.UseSSL)
	cfg.MinIO.URLTTL = getEnvDuration("MINIO_URL_TTL", cfg.MinIO.URLTTL)

	cfg.JWT.Issuer = getEnvString("JWT_ISSUER", cfg.JWT.Issuer)
	cfg.JWT.Audience = getEnvString("JWT_AUDIENCE", cfg.JWT.Audience)
	cfg.JWT.PublicKeyPath = getEnvString("JWT_PUBLIC_KEY_PEM", cfg.JWT.PublicKeyPath)

	return cfg
}

func getEnvString(key string, fallback string) string {
	value, ok := os.LookupEnv(key)
	if !ok || value == "" {
		return fallback
	}

	return value
}

func getEnvBool(key string, fallback bool) bool {
	value, ok := os.LookupEnv(key)
	if !ok || value == "" {
		return fallback
	}

	parsed, err := strconv.ParseBool(value)
	if err != nil {
		panic("invalid boolean value for " + key + ": " + err.Error())
	}

	return parsed
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	value, ok := os.LookupEnv(key)
	if !ok || value == "" {
		return fallback
	}

	parsed, err := time.ParseDuration(value)
	if err != nil {
		panic("invalid duration value for " + key + ": " + err.Error())
	}

	return parsed
}
