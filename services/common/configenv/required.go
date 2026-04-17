package configenv

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// optional env string
func RequiredString(key string) (string, error) {
	value := os.Getenv(key)
	if value == "" {
		return "", fmt.Errorf("missing required env: %s", key)
	}
	return value, nil
}

// must have env string
func MustString(key string) string {
	value, err := RequiredString(key)
	if err != nil {
		panic(err)
	}
	return value
}

// optional env bool
func RequiredBool(key string) (bool, error) {
	value := os.Getenv(key)
	if value == "" {
		return false, fmt.Errorf("missing required env: %s", key)
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("invalid env %s: %w", key, err)
	}
	return parsed, nil
}

// must have env bool
func MustBool(key string) bool {
	value, err := RequiredBool(key)
	if err != nil {
		panic(err)
	}
	return value
}

// optional env duration
func RequiredDuration(key string) (time.Duration, error) {
	value := os.Getenv(key)
	if value == "" {
		return 0, fmt.Errorf("missing required env: %s", key)
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return 0, fmt.Errorf("invalid env %s: %w", key, err)
	}
	return parsed, nil
}

// must have env duration
func MustDuration(key string) time.Duration {
	value, err := RequiredDuration(key)
	if err != nil {
		panic(err)
	}
	return value
}

// optional env int
func RequiredInt(key string) (int, error) {
	value := os.Getenv(key)
	if value == "" {
		return 0, fmt.Errorf("missing required env: %s", key)
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("invalid env %s: %w", key, err)
	}
	return parsed, nil
}

// must have env int
func MustInt(key string) int {
	value, err := RequiredInt(key)
	if err != nil {
		panic(err)
	}
	return value
}
