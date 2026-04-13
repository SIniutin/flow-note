FROM golang:1.24 AS builder
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/notify-service ./notify-service/cmd/notify-service

FROM gcr.io/distroless/static-debian12
COPY --from=builder /bin/notify-service /notify-service
ENTRYPOINT ["/notify-service"]
