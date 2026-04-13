package authsecurity

import "golang.org/x/crypto/bcrypt"

type Bcrypt struct {
	Cost int
}

func (b Bcrypt) Hash(pw string) ([]byte, error) {
	cost := b.Cost
	if cost == 0 {
		cost = bcrypt.DefaultCost
	}
	return bcrypt.GenerateFromPassword([]byte(pw), cost)
}

func (b Bcrypt) Compare(hash []byte, pw string) error {
	return bcrypt.CompareHashAndPassword(hash, []byte(pw))
}
