# collab-service — TODO

## Высокий приоритет

- [ ] **Включить валидацию токена от оргов хакатона**
  Сейчас `onAuthenticate` принимает любой непустой токен (auth отключён для тестирования).
  Когда получишь токен: вставить в `AUTH_TOKEN` env в docker-compose.yml и раскомментировать
  проверку `token !== config.authToken` в `src/index.ts:onAuthenticate`.

- [ ] **Auth middleware в api-gateway**
  Валидация JWT/токена до проброса WS на collab-service.
  Сейчас onAuthenticate проверяет только наличие токена, но не его подпись.

- [ ] **Token-скоупинг таблиц**
  `loadTable` и `observeDeep` используют токен первого подключившегося клиента.
  Варианты: per-connection token map внутри документа, либо service-account токен для MWS.

- [ ] **Проверить `extractMwsTableDstIds` на реальной TipTap-схеме**
  Рекурсия делает `cast child as XmlFragment` и вызывает `toArray()`.
  На `Y.XmlText` это не упадёт (instanceof XmlElement фильтрует), но нужно проверить
  с реальной структурой документа из TipTap.

## Средний приоритет

- [ ] **Sticky-routing через routing HTTP server**
  `GET /page-instance/:pageId` (порт 4001) уже работает.
  Нужно использовать в api-gateway для направления WS на нужный инстанс.
  Варианты реализации: nginx `js_module`, отдельный router-сервис, Traefik plugin.

- [ ] **healthcheck для mock-pages (и prod pages-service)**
  В docker-compose `mock-pages` без healthcheck → collab-service может стартовать
  раньше gRPC-сервера. Добавить `condition: service_healthy` + TCP-проверку порта 50051.

- [ ] **Шум в логах onChange**
  На активном документе каждый Y.js update пишет console.log.
  Добавить флаг `DEBUG_SYNC=true` или убрать лог совсем.

## Низкий приоритет / на будущее

- [ ] **Интеграционные тесты**
  - onLoadDocument: snapshot restore, isFirstLoad логика
  - handleTblOp: optimistic update + rollback при ошибке MWS
  - graceful shutdown: flush до закрытия сервера

- [ ] **Метрики (Prometheus / structured logs)**
  - Кол-во активных документов (`docs.size`)
  - tbl_op/сек, latency MWS PATCH
  - Размер snapshot при flush
  - Можно добавить эндпоинт `GET /metrics` в routingServer.ts
