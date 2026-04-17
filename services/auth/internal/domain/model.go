package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type UserID uuid.UUID
type SessionID uuid.UUID

type UserCreateRequest struct {
	Email string
	Login string
}

type UserLoginRequest struct {
	Email    string
	Login    string
	Password string
}

type User struct {
	ID    UserID
	Email Email
	Login Login
}

type PasswordHash struct {
	Algo string
	Hash []byte
}

type Credentials struct {
	UserID       UserID
	PasswordHash PasswordHash
}

type TokenPair struct {
	AccessToken   string
	RefreshToken  string
	AccessExpires time.Time
}

type RefreshSession struct {
	ID        SessionID
	UserID    UserID
	TokenHash []byte
	CreatedAt time.Time
	ExpiresAt time.Time
	RevokedAt *time.Time
}

func (id UserID) String() string {
	return uuid.UUID(id).String()
}

func (id SessionID) String() string {
	return uuid.UUID(id).String()
}

func (id UserID) MarshalText() ([]byte, error) {
	return []byte(id.String()), nil
}

func (id *UserID) UnmarshalText(text []byte) error {
	parsed, err := uuid.Parse(string(text))
	if err != nil {
		return err
	}
	*id = UserID(parsed)
	return nil
}

func (id UserID) MarshalJSON() ([]byte, error) {
	return json.Marshal(id.String())
}

func (id *UserID) UnmarshalJSON(data []byte) error {
	var raw string
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	return id.UnmarshalText([]byte(raw))
}

func (id SessionID) MarshalText() ([]byte, error) {
	return []byte(id.String()), nil
}

func (id *SessionID) UnmarshalText(text []byte) error {
	parsed, err := uuid.Parse(string(text))
	if err != nil {
		return err
	}
	*id = SessionID(parsed)
	return nil
}

func (id SessionID) MarshalJSON() ([]byte, error) {
	return json.Marshal(id.String())
}

func (id *SessionID) UnmarshalJSON(data []byte) error {
	var raw string
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	return id.UnmarshalText([]byte(raw))
}
