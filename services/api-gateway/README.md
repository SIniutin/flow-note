# `api-gateway`

HTTP gateway for the Todo API project.

It exposes REST endpoints via `grpc-gateway`, validates JWT access tokens, and forwards requests to gRPC services.

## Responsibility

`api-gateway` is responsible for:

- exposing HTTP endpoints defined in `api-contracts`;
- validating access tokens for protected routes;
- passing `Authorization` to downstream gRPC calls;
- serving `/healthz`.

It does not implement domain logic.

## Architecture

The gateway follows a simple layered structure:

- `cmd/gateway`
  entry point;
- `internal/app`
  bootstrap and dependency wiring;
- `internal/middleware`
  JWT and CORS middleware.

Shared infrastructure lives in `common`:

- `common/runtime`
- `common/authsecurity`

## API

HTTP endpoints are generated from protobuf annotations in `api-contracts`:

- `api-contracts/proto/auth/v1/auth.proto`

## Auth Behavior

Public routes:

- `/healthz`
- `/v1alpha/auth/login`
- `/v1alpha/auth/register`
- `/v1alpha/auth/refresh`
- `/v1alpha/auth/logout`

All other routes require:

`Authorization: Bearer <token>`

## Configuration

Configuration is provided through environment variables.

Main variables:

- `GATEWAY_ADDR`
- `AUTH_GRPC_ADDR`
- `COLLAB_ADDR`
- `JWT_PUBLIC_KEY_PEM`
- `JWT_ISSUER`
- `JWT_AUDIENCE`

## Local Run

Requirements:

- Go
- RSA public key in PEM format

Run:

```bash
cd api-gateway
export JWT_PUBLIC_KEY_PEM=/absolute/path/to/public.pem
go run ./cmd/gateway
```

Defaults:

- HTTP: `:8080`
- Auth gRPC: `127.0.0.1:50052`
- Collab upstream: `127.0.0.1:4000`

## Testing

Run:

```bash
GOCACHE=/tmp/go-build go test ./...
```

## Current Limitations

- no TLS to upstream gRPC services;
- no structured access logging;
- CORS is permissive by default.

## Summary

Main design choices:

- expose REST from protobuf annotations;
- keep JWT validation at the gateway;
- keep gateway logic minimal and stateless.
