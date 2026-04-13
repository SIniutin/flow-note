SECRETS_DIR := secrets
PRIVATE_KEY  := $(SECRETS_DIR)/jwt_private_key.pem
PUBLIC_KEY   := $(SECRETS_DIR)/jwt_public_key.pem

.PHONY: up down restart logs keys frontend dev

## Generate JWT keys if missing
keys:
	@if [ ! -f $(PRIVATE_KEY) ]; then \
		echo "Generating RSA key pair..."; \
		openssl genrsa -out $(PRIVATE_KEY) 2048; \
		openssl rsa -in $(PRIVATE_KEY) -pubout -out $(PUBLIC_KEY); \
		echo "Keys written to $(SECRETS_DIR)/"; \
	else \
		echo "Keys already exist, skipping."; \
	fi

## Build and start the full backend stack
up: keys
	docker compose up --build -d

## Stop all services
down:
	docker compose down

## Restart a specific service: make restart svc=auth-service
restart:
	docker compose restart $(svc)

## Tail logs for all services (or: make logs svc=api-gateway)
logs:
	docker compose logs -f $(svc)

## Install frontend deps
frontend:
	cd frontend && npm install

## Start frontend dev server (requires backend running via `make up`)
dev: frontend
	cd frontend && npm run dev
