package app

import "github.com/tasker-iniutin/common/configenv"

type Config struct {
	HTTPAddr      string
	AuthGRPCAddr  string
	CollabAddr    string
	PublicKeyPath string
	JWTIssuer     string
	JWTAudience   string
	AllowedOrigin string
}

func LoadConfig() Config {
	return Config{
		HTTPAddr:      configenv.String("GATEWAY_ADDR", ":8080"),
		AuthGRPCAddr:  configenv.String("AUTH_GRPC_ADDR", "127.0.0.1:50052"),
		CollabAddr:    configenv.String("COLLAB_ADDR", "127.0.0.1:4000"),
		PublicKeyPath: configenv.String("JWT_PUBLIC_KEY_PEM", ""),
		JWTIssuer:     configenv.String("JWT_ISSUER", "todo-auth"),
		JWTAudience:   configenv.String("JWT_AUDIENCE", "todo-api"),
		AllowedOrigin: configenv.String("ALLOWED_ORIGIN", "localhost:5173"),
	}
}
