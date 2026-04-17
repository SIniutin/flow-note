package configenv

import (
	"os"
	"strconv"
	"time"
)

func String(key, def string) string {
	value := os.Getenv(key)
	if value == "" {
		return def
	}
	return value
}

func Bool(key string, def bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return def
	}

	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return def
	}
	return parsed
}

func Duration(key string, def time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return def
	}

	parsed, err := time.ParseDuration(value)
	if err != nil {
		return def
	}
	return parsed
}
