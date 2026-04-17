FROM golang:1.26-alpine AS build

WORKDIR /src

# Copy shared local modules referenced by replace directives
COPY common/ /src/common/
COPY api-contracts/ /src/api-contracts/

# Build comment-service
WORKDIR /src/comment-service
COPY comment-service/go.mod comment-service/go.sum ./
RUN go mod download

COPY comment-service/cmd        ./cmd
COPY comment-service/db ./db
COPY comment-service/internal   ./internal

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/comment-service ./cmd/comment-service

FROM alpine:3.21

WORKDIR /app

COPY --from=build /out/comment-service /usr/local/bin/comment-service

EXPOSE 9091

ENTRYPOINT ["/usr/local/bin/comment-service"]
