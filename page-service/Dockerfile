# syntax=docker/dockerfile:1

FROM golang:1.26-alpine AS build

WORKDIR /src/page-service

COPY common /src/common
COPY api-contracts /src/api-contracts
COPY page-service/go.mod page-service/go.sum ./

RUN go mod download

COPY page-service/cmd ./cmd
COPY page-service/config ./config
COPY page-service/db ./db
COPY page-service/internal ./internal

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/page-service ./cmd/pages

FROM alpine:3.21

WORKDIR /app

COPY --from=build /out/page-service /usr/local/bin/page-service

EXPOSE 8080 50051

ENTRYPOINT ["/usr/local/bin/page-service"]
