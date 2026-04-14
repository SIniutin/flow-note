package configenv

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

func Int(key string, def int) int {
	value := os.Getenv(key)
	if value == "" {
		return def
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return def
	}
	return parsed
}

func Strings(key string, def []string) []string {
	value := os.Getenv(key)
	if value == "" {
		return def
	}
	out := splitAndClean(value)
	if len(out) == 0 {
		return def
	}
	return out
}

func RequiredStrings(key string) ([]string, error) {
	value := os.Getenv(key)
	if value == "" {
		return nil, fmt.Errorf("missing required env: %s", key)
	}
	out := splitAndClean(value)
	if len(out) == 0 {
		return nil, fmt.Errorf("empty required env: %s", key)
	}
	return out, nil
}

func splitAndClean(value string) []string {
	raw := strings.Split(value, ",")
	out := make([]string, 0, len(raw))
	for _, item := range raw {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		out = append(out, item)
	}
	return out
}
