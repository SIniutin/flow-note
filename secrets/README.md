# JWT Keys

Generate RSA key pair before starting the stack:

```sh
# Private key (auth-service signs tokens)
openssl genrsa -out secrets/jwt_private_key.pem 2048

# Public key (api-gateway verifies tokens)
openssl rsa -in secrets/jwt_private_key.pem -pubout -out secrets/jwt_public_key.pem
```

Files `*.pem` are gitignored.
