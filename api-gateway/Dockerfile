FROM golang:1.25-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal
COPY proto ./proto

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/api-gateway ./cmd/gateway

FROM alpine:3.21

WORKDIR /app

COPY --from=build /out/api-gateway /usr/local/bin/api-gateway

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/api-gateway"]
