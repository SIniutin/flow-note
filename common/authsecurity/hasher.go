package authsecurity

type Hasher interface {
	Hash(password string) ([]byte, error)
	Compare(hash []byte, password string) error
}
