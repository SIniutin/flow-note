package authsecurity

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"os"
)

// ---------- Public key ----------

func LoadRSAPublicKeyFromPEMFile(path string) (*rsa.PublicKey, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return ParseRSAPublicKeyPEM(b)
}

func ParseRSAPublicKeyPEM(pemBytes []byte) (*rsa.PublicKey, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, errors.New("bad pem: no block")
	}

	// "PUBLIC KEY" (PKIX)
	if k, err := x509.ParsePKIXPublicKey(block.Bytes); err == nil {
		pub, ok := k.(*rsa.PublicKey)
		if !ok {
			return nil, errors.New("pem is not RSA public key")
		}
		return pub, nil
	}

	// "RSA PUBLIC KEY" (PKCS#1)
	if pub, err := x509.ParsePKCS1PublicKey(block.Bytes); err == nil {
		return pub, nil
	}

	return nil, errors.New("failed to parse rsa public key")
}

// ---------- Private key ----------

func LoadRSAPrivateKeyFromPEMFile(path string) (*rsa.PrivateKey, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return ParseRSAPrivateKeyPEM(b)
}

func ParseRSAPrivateKeyPEM(pemBytes []byte) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, errors.New("bad pem: no block")
	}

	// "RSA PRIVATE KEY" (PKCS#1)
	if k, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return k, nil
	}

	// "PRIVATE KEY" (PKCS#8)
	if k, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		priv, ok := k.(*rsa.PrivateKey)
		if !ok {
			return nil, errors.New("pem is not RSA private key")
		}
		return priv, nil
	}

	return nil, errors.New("failed to parse rsa private key")
}
