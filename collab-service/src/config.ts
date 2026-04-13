/**
 * Единая точка конфигурации collab-service.
 * Все значения берутся из env с разумными дефолтами для локальной разработки.
 */

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function str(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  // ── Server ────────────────────────────────────────────────────────────────
  port: int("PORT", 4000),
  /** Таймаут hocuspocus на бездействие коннекта, мс */
  wsTimeout: int("WS_TIMEOUT_MS", 120_000),

  // ── Redis ─────────────────────────────────────────────────────────────────
  redisUrl:      str("REDIS_URL",       "redis://localhost:6379"),
  instanceAddr:  str("INSTANCE_ADDR",   "collab-service:4000"),

  // ── gRPC / pages-service ──────────────────────────────────────────────────
  pagesGrpcAddr:      str("PAGES_GRPC_ADDR",          "localhost:50051"),
  snapshotTimeoutMs:  int("SNAPSHOT_TIMEOUT_MS",       8_000),
  grpcFlushAttempts:  int("GRPC_FLUSH_MAX_ATTEMPTS",   5),
  grpcFlushBaseDelayMs: 1_000,

  // ── MWS Tables API ────────────────────────────────────────────────────────
  mwsApiBase:     str("MWS_API_BASE",    "http://mws-api/fusion/v1"),
  mwsTimeoutMs:   int("MWS_TIMEOUT_MS",  8_000),
  mwsPageSize:    int("MWS_PAGE_SIZE",   100),
  /** Idle-таймаут кеша таблицы без обращений → eviction, мс */
  tableIdleMs:    int("TABLE_IDLE_MS",   5 * 60_000),

  // ── DocFlusher ────────────────────────────────────────────────────────────
  /** Интервал периодического flush snapshot → pages-service, мс */
  flushIntervalMs:  int("FLUSH_INTERVAL_MS",  3 * 60_000),
  /** Idle-таймаут документа без изменений → финальный flush + выгрузка, мс */
  docIdleMs:        int("DOC_IDLE_MS",         60_000),

  // ── Routing HTTP server ───────────────────────────────────────────────────
  /** Порт внутреннего HTTP-сервера для маршрутизации (GET /page-instance/:id) */
  routingPort:      int("ROUTING_PORT",  4001),

  // ── Redis TTL ─────────────────────────────────────────────────────────────
  /** TTL ключа collab:page:* в Redis, секунды (обновляется при периодическом flush) */
  redisTtlSec:      int("REDIS_TTL_SEC", 86_400),  // 24 h

  // ── JWT ───────────────────────────────────────────────────────────────────
  /** RSA public key PEM для верификации JWT (path к файлу или сам PEM-текст) */
  jwtPublicKeyPem:  str("JWT_PUBLIC_KEY_PEM", ""),
  jwtIssuer:        str("JWT_ISSUER",         "flow-note-auth"),
  jwtAudience:      str("JWT_AUDIENCE",       "flow-note-api"),
} as const;
