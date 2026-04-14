package app

import "github.com/spf13/viper"

type Config struct {
	HTTPAddr       string
	AuthGRPCAddr   string
	CollabGRPCAddr string
	CommentGRPCAddr string
	CollabAddr     string
	PublicKeyPath  string
	JWTIssuer      string
	JWTAudience    string
	AllowedOrigin  string
}

func LoadConfig() Config {
	v := viper.New()
	v.AutomaticEnv()

	v.SetDefault("GATEWAY_ADDR", ":8080")
	v.SetDefault("AUTH_GRPC_ADDR", "127.0.0.1:50052")
	v.SetDefault("COLLAB_GRPC_ADDR", "127.0.0.1:50053")
	v.SetDefault("COMMENT_GRPC_ADDR", "127.0.0.1:9091")
	v.SetDefault("COLLAB_ADDR", "127.0.0.1:4000")
	v.SetDefault("JWT_PUBLIC_KEY_PEM", "")
	v.SetDefault("JWT_ISSUER", "todo-auth")
	v.SetDefault("JWT_AUDIENCE", "todo-api")
	v.SetDefault("ALLOWED_ORIGIN", "")

	return Config{
		HTTPAddr:       v.GetString("GATEWAY_ADDR"),
		AuthGRPCAddr:   v.GetString("AUTH_GRPC_ADDR"),
		CollabGRPCAddr: v.GetString("COLLAB_GRPC_ADDR"),
		CommentGRPCAddr: v.GetString("COMMENT_GRPC_ADDR"),
		CollabAddr:     v.GetString("COLLAB_ADDR"),
		PublicKeyPath:  v.GetString("JWT_PUBLIC_KEY_PEM"),
		JWTIssuer:      v.GetString("JWT_ISSUER"),
		JWTAudience:    v.GetString("JWT_AUDIENCE"),
		AllowedOrigin:  v.GetString("ALLOWED_ORIGIN"),
	}
}
