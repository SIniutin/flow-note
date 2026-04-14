FROM golang:1.26-alpine AS build

WORKDIR /src/auth-service

COPY common /src/common
COPY api-contracts /src/api-contracts
COPY auth-service/go.mod auth-service/go.sum ./
RUN go mod download

COPY auth-service/cmd ./cmd
COPY auth-service/db ./db
COPY auth-service/internal ./internal
COPY auth-service/README.md ./README.md

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/auth-service ./cmd/auth-service

FROM alpine:3.21

WORKDIR /app

COPY --from=build /out/auth-service /usr/local/bin/auth-service

EXPOSE 50052

ENTRYPOINT ["/usr/local/bin/auth-service"]
