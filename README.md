# Flow Note Comments + Notifications MVP

## Шаг 1. Архитектурное решение

Для MVP выбрано `RabbitMQ`, а не Kafka: у нас event-driven слой нужен прежде всего для надежной публикации доменных событий из producer-сервисов в `notify-service`, без тяжелой стриминговой инфраструктуры. Сам `notify-service` сейчас не использует gRPC: он получает события из RabbitMQ, пишет inbox в PostgreSQL и публикует realtime payload в Redis для gateway.

Коммуникация:

- `comment-service` принимает синхронные команды по gRPC, пишет комментарии в PostgreSQL и после успешного commit публикует события напрямую в RabbitMQ.
- `notify-service` консюмирует события из RabbitMQ, атомарно пишет `processed_events + notifications` в PostgreSQL и публикует realtime payload в Redis pub/sub.
- Gateway считается внешним consumer’ом Redis channels `notifications:{user_id}`.

## Структура репозитория

```text
.
├── .env.example
├── Makefile
├── README.md
├── docker-compose.yml
├── go.mod
├── go.work
├── common/
│   ├── apperrors/
│   ├── authctx/
│   ├── broker/
│   ├── events/
│   ├── realtime/
│   ├── runtime/
│   └── testutil/
├── comment-service/
│   ├── cmd/comment-service/
│   ├── internal/
│   ├── migrations/
│   └── Dockerfile
└── notify-service/
    ├── cmd/notify-service/
    ├── internal/
    ├── migrations/
    └── Dockerfile
```

## Шаг 2. Shared foundation

- Event contracts: [common/events/contracts.go](/Users/redkindanil/Documents/GitHub/flow-note/common/events/contracts.go)
- JSON schemas: [common/events/schemas](/Users/redkindanil/Documents/GitHub/flow-note/common/events/schemas/comment.thread.created.json)
- RabbitMQ adapter: [common/broker/rabbitmq.go](/Users/redkindanil/Documents/GitHub/flow-note/common/broker/rabbitmq.go)
- Redis realtime publisher: [common/realtime/redis.go](/Users/redkindanil/Documents/GitHub/flow-note/common/realtime/redis.go)

## Шаг 3. comment-service

Ключевые файлы:

- Domain models: [anchor.go](/Users/redkindanil/Documents/GitHub/flow-note/comment-service/internal/domain/anchor.go), [body.go](/Users/redkindanil/Documents/GitHub/flow-note/comment-service/internal/domain/body.go), [models.go](/Users/redkindanil/Documents/GitHub/flow-note/comment-service/internal/domain/models.go)
- Repository: [postgres.go](/Users/redkindanil/Documents/GitHub/flow-note/comment-service/internal/repository/postgres.go)
- Service: [service.go](/Users/redkindanil/Documents/GitHub/flow-note/comment-service/internal/service/service.go)
- HTTP API: [handler.go](/Users/redkindanil/Documents/GitHub/flow-note/comment-service/internal/handler/http/handler.go)
- Migration: [00001_init.sql](/Users/redkindanil/Documents/GitHub/flow-note/comment-service/migrations/00001_init.sql)

### Как устроен publish после commit

В `CreateThread` и `AddReply` сервис:

1. в одной PostgreSQL транзакции пишет доменные таблицы
2. собирает integration events в памяти
3. после успешного commit публикует их напрямую в RabbitMQ

Смотри:

- [createThreadTx](/Users/redkindanil/Documents/GitHub/flow-note/comment-service/internal/service/service.go)
- [persistReply](/Users/redkindanil/Documents/GitHub/flow-note/comment-service/internal/service/service.go)
- [publishBatch](/Users/redkindanil/Documents/GitHub/flow-note/comment-service/internal/service/service.go)

### gRPC API comment-service

- `comment.v1.CommentService/CreateThread`
- `comment.v1.CommentService/ListThreads`
- `comment.v1.CommentService/ListDiscussions`
- `comment.v1.CommentService/GetThread`
- `comment.v1.CommentService/AddReply`
- `comment.v1.CommentService/ResolveThread`
- `comment.v1.CommentService/ReopenThread`
- `comment.v1.CommentService/DeleteComment`
- `comment.v1.CommentService/FollowThread`
- `comment.v1.CommentService/UnfollowThread`

Контракт находится в [proto/comment/v1/comment.proto](/Users/redkindanil/Documents/GitHub/flow-note/proto/comment/v1/comment.proto), а generated stubs лежат рядом в [proto/comment/v1/comment.pb.go](/Users/redkindanil/Documents/GitHub/flow-note/proto/comment/v1/comment.pb.go) и [proto/comment/v1/comment_grpc.pb.go](/Users/redkindanil/Documents/GitHub/flow-note/proto/comment/v1/comment_grpc.pb.go). Для вызовов `comment-service` нужно передавать gRPC metadata `x-user-id`.

HTTP в `comment-service` теперь используется только для `/healthz`, `/readyz`, `/metrics`.

## Шаг 4. notify-service

Ключевые файлы:

- Repository: [postgres.go](/Users/redkindanil/Documents/GitHub/flow-note/notify-service/internal/repository/postgres.go)
- Service/router: [service.go](/Users/redkindanil/Documents/GitHub/flow-note/notify-service/internal/service/service.go)
- Consumer: [consumer.go](/Users/redkindanil/Documents/GitHub/flow-note/notify-service/internal/consumer/consumer.go)
- Migration: [00001_init.sql](/Users/redkindanil/Documents/GitHub/flow-note/notify-service/migrations/00001_init.sql)

### Как устроена идемпотентность consumer

1. Consumer читает событие из RabbitMQ.
2. `notify-service` считает recipients.
3. В одной PostgreSQL транзакции делает `INSERT processed_events ... ON CONFLICT DO NOTHING`.
4. Если event новый, там же пишет `notifications`.
5. После commit публикует payload в Redis channel `notifications:{user_id}`.
6. Только после этого сообщение ack-ается RabbitMQ consumer’ом.

Смотри:

- [ProcessEvent](/Users/redkindanil/Documents/GitHub/flow-note/notify-service/internal/service/service.go)
- [SaveEventNotifications](/Users/redkindanil/Documents/GitHub/flow-note/notify-service/internal/repository/postgres.go)
- [Consumer.Run](/Users/redkindanil/Documents/GitHub/flow-note/notify-service/internal/consumer/consumer.go)

Уникальный индекс `notifications.dedupe_key` дополнительно защищает от дублей на inbox-side.

### notify-service

`notify-service` сейчас не поднимает gRPC API. Он работает как consumer:

1. получает event из RabbitMQ
2. сохраняет notification в PostgreSQL
3. публикует `notifications:{user_id}` в Redis
4. gateway подписывается на Redis и уже сам отправляет SSE/WebSocket в браузер

У `notify-service` больше нет HTTP layer. Это чистый background worker.

## Шаг 5. Запуск

### Docker compose

```bash
make up
```

### Локальные тесты

```bash
make test
```

### Что поднять вручную

- `postgres_comment`
- `postgres_notify`
- `rabbitmq`
- `redis`
- `comment-service` gRPC `:9091`, infra HTTP `:8081`
- `notify-service`

## Проверка сценариев

### Проверить publish

1. Создать thread через `comment-service`.
2. Убедиться, что `comment-service` сразу публикует событие в RabbitMQ.
3. Посмотреть, что `notify-service` создал записи в `notifications`.

### Проверить notifications

1. Убедиться, что `notify-service` подписан на queue `notify-service.events`.
2. Создать comment/reply/mention.
3. Посмотреть таблицу `notifications` в `notifydb`.

### Проверить mentions feed

Если нужен inbox read API, его можно вынести либо в gateway, либо позже вернуть отдельным transport слоем. В текущем варианте `notify-service` отвечает только за event consumption и realtime publish.

### Проверить realtime

`notify-service` публикует в Redis channel `notifications:{user_id}`. Дальше это уже зона `gateway`: он подписывается на Redis и отдает браузеру SSE/WebSocket.

## Ограничения текущего MVP

- Внешние `pages/auth/gateway` зависимости сейчас stubbed, но интерфейсы оставлены под gRPC адаптеры.
- Миграции `goose` включены как SQL-файлы; wiring отдельного migrate CLI можно добавить следующим шагом.
- Для transport слоя выбран pragmatic gRPC с JSON codec. Если захочешь, следующим шагом можно заменить это на полноценные `.proto` + generated stubs.
