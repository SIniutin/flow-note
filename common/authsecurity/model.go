package authsecurity

import (
	"time"
)

type Verifier interface {
	VerifyAccess(tokenStr string) (userID string, err error)
}

type Issuer interface {
	NewAccess(userID string) (token string, exp time.Time, err error)
	NewRefresh() (token string, hash []byte, err error)
}
