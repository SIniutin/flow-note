SECRETS_DIR := secrets
PRIVATE_KEY  := $(SECRETS_DIR)/jwt_private_key.pem
PUBLIC_KEY   := $(SECRETS_DIR)/jwt_public_key.pem

.PHONY: up down restart logs keys frontend dev auth-clear node-deps db-reset

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

## Ensure local Node.js dependencies exist for project packages
node-deps:
	@for dir in collab-service meta-parser frontend; do \
		if [ -f "$$dir/package.json" ]; then \
			if [ ! -d "$$dir/node_modules" ]; then \
				echo "Installing npm dependencies in $$dir..."; \
				(cd "$$dir" && npm install); \
			else \
				echo "$$dir dependencies already installed, skipping."; \
			fi; \
		fi; \
	done

## Build and start the full backend stack
up: keys node-deps
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

## Clear auth tables in PostgreSQL
auth-clear:
	docker compose exec -T postgres psql -U postgres -d auth -c "TRUNCATE TABLE users CASCADE;"

## Drop all app tables and migration history in every Postgres database
db-reset:
	sh ./scripts/reset-databases.sh

## Install frontend deps
frontend:
	cd frontend && npm install

## Start frontend dev server (requires backend running via `make up`)
dev: frontend
	cd frontend && npm run dev
