FROM golang:1.26-alpine AS build

WORKDIR /src

COPY common/ /src/common/
COPY api-contracts/ /src/api-contracts/

WORKDIR /src/media-service
COPY media-service/go.mod media-service/go.sum ./
RUN go mod download

COPY media-service/cmd ./cmd
COPY media-service/config ./config
COPY media-service/internal ./internal

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/media-service ./cmd/media

FROM alpine:3.21

WORKDIR /app

COPY --from=build /out/media-service /usr/local/bin/media-service

EXPOSE 8082
EXPOSE 50054

ENTRYPOINT ["/usr/local/bin/media-service"]
