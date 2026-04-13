FROM golang:1.24 AS builder
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/comment-service ./comment-service/cmd/comment-service

FROM gcr.io/distroless/static-debian12
COPY --from=builder /bin/comment-service /comment-service
ENTRYPOINT ["/comment-service"]
