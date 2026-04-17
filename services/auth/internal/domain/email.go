package domain

import (
	"errors"
	"regexp"
	"strings"
)

var (
	ErrEmptyEmail         = errors.New("email is empty")
	ErrEmailTooLong       = errors.New("email is too long")
	ErrInvalidEmailFormat = errors.New("email has invalid format")
)

type Email string

var emailRegexp = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

func NewEmail(raw string) (*Email, error) {
	v := strings.TrimSpace(strings.ToLower(raw))

	if v == "" {
		return nil, ErrEmptyEmail
	}
	if len(v) > 254 {
		return nil, ErrEmailTooLong
	}
	if !emailRegexp.MatchString(v) {
		return nil, ErrInvalidEmailFormat
	}

	email := Email(v)
	return &email, nil
}
