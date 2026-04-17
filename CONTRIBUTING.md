# Contributing to flow-note

## Repository structure

```
flow-note/
├── services/
│   ├── api-contracts/   # .proto
│   ├── api-gateway/     # Go
│   ├── auth/            # Go
│   ├── pages/           # Go
│   ├── comment/         # Go
│   ├── common/          # Go
│   ├── notify/          # Go
│   ├── media/           # Go
│   ├── collab/          # Node.js
│   └── meta-parser/     # Node.js
├── frontend/
├── docker-compose.yml
├── .golangci.yml
├── yDoc-contract.yaml
└── CONTRIBUTING.md
```

---

## Structure of basic Go service

```go
service/
├── cmd/<service_name>/
│   └── main.go        // entry point
├── internal/
│   ├── app/           // Application loop and acquiring resources
│   ├── handler/       // HTTP/gRPC/WS handlers
│   ├── usecase/       // business logic
│   ├── repository/    // storage
│   └── domain/        // model and domain structures
├── config/
│   └── config.go
├── db/
│   ├── migrate.go
│   └── migrations/
├── Dockerfile
└── go.mod
```

**Правила:**
- Code only in `internal/`, none of the code in root of the service except `cmd/`
- Architecture layers must be named correctly: `handler`, `usecase`, `repository`.
- No global variables
- Config using .env

---

## Structure of Node.js service

```
service/
├── src/
│   ├── handlers/
│   ├── services/
│   └── models/
├── index.js
├── package.json
└── Dockerfile
```

---

## Message formats

### Kafka events

Все события через Kafka используют единый envelope:

```json
{
  "event_id": "uuid",
  "event_type": "page.flushed",
  "timestamp": "2024-01-01T00:00:00Z",
  "payload": {}
}
```

**Типы событий:**
| event_type | Продюсер | Консьюмер |
|---|---|---|
| `page.flushed` | collab | meta-parser |
| `page.parsed` | meta-parser | pages |
| `mention.detected` | pages | notify |

### RabbitMQ events

```json
{
  "notification_id": "uuid",
  "type": "mention",
  "user_id": "uuid",
  "payload": {}
}
```

### HTTP ошибки

Все сервисы возвращают одинаковый формат:

```json
{
  "error": "human readable message",
  "code": "SNAKE_CASE_CODE"
}
```

**Коды ошибок:**
- `NOT_FOUND`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `INTERNAL_ERROR`

---

## Git

### Branches

```go
feature/<name>     // new feature
fix/<name>         // bug fix
refactor/<name>    // refactoring
test/<name>        // tests
```

### Conventional Commits

```
feat: add websocket reconnection in collab
fix: fix session expiry in auth
refactor: extract flush logic to separate service
test: add e2e for page creation flow
chore: update golangci config
```

**Format:** `<тип>: <описание в lowercase>`

Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`

---

## Linter (Go)

File `.golangci.yml` in the root of the repo — same for all Go services.

```bash
# Запустить перед каждым пушем //TODO make a job
golangci-lint run ./...
```

**Must-have linters:**
- `errcheck` — all errors must be handled
- `govet` — standard checks
- `staticcheck` — static analysis
- `gofmt` — formatting

---

## Tests

### Coverage rules

| Layer | Type | min |
|---|---|---|
| `service/` | unit | 80% |
| `repository/` | integration |  |
| `critical` | e2e | must be |

### Running

```bash
# unit тесты
go test ./internal/...

# integration тесты
go test ./... -tags=integration

# e2e
go test ./tests/e2e/...
```

---

## Local run

```bash
# Скопируй и заполни переменные окружения
cp .env.example .env

# Поднять все сервисы
make up

# Остановить
make down
```

---

## Outbox pattern

Все сервисы которые пишут в БД и публикуют события используют outbox:

1. Запись в основную таблицу + запись в `outbox` — в одной транзакции
2. Отдельный воркер читает `outbox` и публикует в брокер
3. При успехе — помечает запись как отправленную

**Никогда не публикуем событие вне транзакции с основной записью.**

---

## Checklist перед PR

- [ ] `golangci-lint run ./...` без ошибок
- [ ] Тесты проходят `go test ./...`
- [ ] Новый код покрыт тестами
- [ ] Kafka/Rabbit сообщения соответствуют формату выше
- [ ] HTTP ошибки в едином формате
- [ ] Dockerfile обновлён если добавлены новые зависимости
- [ ] События пишутся через outbox (не напрямую в брокер)