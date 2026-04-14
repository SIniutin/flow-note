package authsecurity

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type AccessClaims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

type rs256Issuer struct {
	privateKey *rsa.PrivateKey
	issuer     string
	audience   string
	ttl        time.Duration
	kid        string
}

func NewRS256Issuer(priv *rsa.PrivateKey, issuer, audience string, ttl time.Duration, kid string) *rs256Issuer {
	return &rs256Issuer{
		privateKey: priv,
		issuer:     issuer,
		audience:   audience,
		ttl:        ttl,
		kid:        kid,
	}
}

func (i *rs256Issuer) NewAccess(userID string, role string) (string, time.Time, error) {
	now := time.Now()
	exp := now.Add(i.ttl)

	claims := AccessClaims{
		Role: role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			Issuer:    i.issuer,
			Audience:  jwt.ClaimStrings{i.audience},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}

	t := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	if i.kid != "" {
		t.Header["kid"] = i.kid
	}

	token, err := t.SignedString(i.privateKey)
	return token, exp, err
}

func (i *rs256Issuer) NewRefresh() (token string, hash []byte, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return "", nil, err
	}

	token = base64.RawURLEncoding.EncodeToString(b)

	sum := sha256.Sum256([]byte(token))
	hash = sum[:]
	return token, hash, nil
}

func RefreshHash(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}

type rs256Verifier struct {
	publicKey *rsa.PublicKey
	issuer    string
	audience  string
}

func NewRS256Verifier(pub *rsa.PublicKey, issuer, audience string) *rs256Verifier {
	return &rs256Verifier{publicKey: pub, issuer: issuer, audience: audience}
}

func (v *rs256Verifier) VerifyAccess(tokenStr string) (userID string, role string, err error) {
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}),
		jwt.WithIssuer(v.issuer),
		jwt.WithAudience(v.audience),
		jwt.WithLeeway(30*time.Second),
	)

	var claims AccessClaims
	_, err = parser.ParseWithClaims(tokenStr, &claims, func(t *jwt.Token) (any, error) {
		return v.publicKey, nil
	})
	if err != nil {
		return "", "", err
	}

	if claims.Subject == "" {
		return "", "", errors.New("missing sub")
	}
	if claims.Role == "" {
		return "", "", errors.New("missing role")
	}

	return claims.Subject, claims.Role, nil
}
