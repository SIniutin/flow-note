# syntax=docker/dockerfile:1

FROM golang:1.24 AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /page-service ./cmd/page-service

FROM alpine:3.20

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /page-service /app/page-service
COPY .env /app/.env

USER app

EXPOSE 8080 50051

CMD ["/app/page-service"]