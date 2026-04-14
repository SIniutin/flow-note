FROM golang:1.26-alpine AS build

WORKDIR /src

# Copy shared local modules referenced by replace directives
COPY common/ /src/common/
COPY api-contracts/ /src/api-contracts/

# Build notify-service
WORKDIR /src/notify-service
COPY notify-service/go.mod notify-service/go.sum ./
RUN go mod download

COPY notify-service/cmd        ./cmd
COPY notify-service/internal   ./internal

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/notify-service ./cmd/notify-service

FROM alpine:3.21

WORKDIR /app

COPY --from=build /out/notify-service /usr/local/bin/notify-service

EXPOSE 9092

ENTRYPOINT ["/usr/local/bin/notify-service"]
