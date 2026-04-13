package domain

import (
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"
)

var (
	ErrEmptyLogin         = errors.New("login is empty")
	ErrLoginTooShort      = errors.New("login is too short")
	ErrLoginTooLong       = errors.New("login is too long")
	ErrInvalidLoginFormat = errors.New("login has invalid format")
)

type Login string

const (
	loginMinLen = 3
	loginMaxLen = 32
)

var loginRegexp = regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)

func NewLogin(raw string) (*Login, error) {
	v := strings.TrimSpace(raw)
	n := utf8.RuneCountInString(v)

	if v == "" {
		return nil, ErrEmptyLogin
	}
	if n < loginMinLen {
		return nil, ErrLoginTooShort
	}
	if n > loginMaxLen {
		return nil, ErrLoginTooLong
	}
	if !loginRegexp.MatchString(v) {
		return nil, ErrInvalidLoginFormat
	}

	login := Login(v)
	return &login, nil
}
