FROM golang:1.26-alpine AS build

WORKDIR /src

# api-gateway has a replace directive: github.com/flow-note/api-contracts => ../api-contracts
COPY api-contracts/ /src/api-contracts/

WORKDIR /src/api-gateway
COPY api-gateway/go.mod api-gateway/go.sum ./
RUN go mod download

COPY api-gateway/cmd      ./cmd
COPY api-gateway/internal ./internal

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/api-gateway ./cmd/gateway

FROM alpine:3.21

WORKDIR /app

COPY --from=build /out/api-gateway /usr/local/bin/api-gateway

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/api-gateway"]
