SHELL := /bin/zsh
GOCACHE := $(CURDIR)/.gocache
GOMODCACHE := $(CURDIR)/.gomodcache

.PHONY: test build up down fmt proto

fmt:
	GOCACHE=$(GOCACHE) GOMODCACHE=$(GOMODCACHE) gofmt -w common comment-service notify-service proto

test:
	GOCACHE=$(GOCACHE) GOMODCACHE=$(GOMODCACHE) go test ./comment-service/... ./notify-service/...

build:
	GOCACHE=$(GOCACHE) GOMODCACHE=$(GOMODCACHE) go build ./comment-service/cmd/comment-service ./notify-service/cmd/notify-service

up:
	docker compose up --build

down:
	docker compose down -v

proto:
	PATH=$(CURDIR)/.bin:$$PATH protoc -I . -I third_party \
		--go_out=. --go_opt=module=github.com/redkindanil/flow-note \
		--go-grpc_out=. --go-grpc_opt=module=github.com/redkindanil/flow-note \
		proto/comment/v1/comment.proto
