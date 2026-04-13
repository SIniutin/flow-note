package testutil

import "github.com/google/uuid"

func MustUUID(raw string) uuid.UUID {
	return uuid.MustParse(raw)
}
