/**
 * Redis-based outbox для надёжной доставки событий в Kafka.
 *
 * Состояния записи:
 *   pending  — blob загружен в S3, Kafka ещё не получил событие
 *   done     — событие успешно опубликовано (запись живёт 7 дней, потом истекает)
 *   failed   — исчерпаны попытки; запись в outbox:failed для ручного разбора
 *
 * Структура в Redis:
 *   HASH  outbox:entry:{id}  — поля записи
 *   ZSET  outbox:pending     — score = scheduled_at (ms), member = id
 *   SET   outbox:failed      — id'шники провальных записей
 *
 * Гарантии:
 *   - ZRANGEBYSCORE + ZREM: несколько инстансов collab-service не дублируют обработку
 *     (zrem возвращает 0 если id уже взял другой инстанс → skip).
 *   - Если инстанс упал после ZREM но до publish → запись потеряна из очереди,
 *     но entry hash остаётся в Redis со статусом pending для ручного восстановления.
 */

import { redis } from "../redis/pageRegistry";

export type OutboxStatus = "pending" | "done" | "failed";

const QUEUE_KEY    = "outbox:pending";
const FAILED_KEY   = "outbox:failed";
const MAX_ATTEMPTS = 5;
const DONE_TTL_SEC = 7 * 86_400;  // 7 дней

/**
 * Добавляет запись в outbox после успешной загрузки blob в S3.
 */
export async function enqueueOutbox(
  pageId:    string,
  s3Key:     string,
  sizeBytes: number,
  ts:        number,
): Promise<void> {
  const id  = crypto.randomUUID();
  const now = Date.now();

  await redis
    .pipeline()
    .hset(`outbox:entry:${id}`, {
      id,
      page_id:    pageId,
      s3_key:     s3Key,
      size_bytes: sizeBytes,
      ts,
      status:     "pending" satisfies OutboxStatus,
      attempts:   0,
      created_at: now,
    })
    .zadd(QUEUE_KEY, now, id)
    .exec();
}

/**
 * Обрабатывает до 10 готовых к отправке записей из очереди.
 * Вызывается периодически из outboxPublisher.
 */
export async function drainOutbox(
  publishFn: (pageId: string, s3Key: string, sizeBytes: number, ts: number) => Promise<void>,
): Promise<void> {
  const now  = Date.now();
  const ids  = await redis.zrangebyscore(QUEUE_KEY, "-inf", now, "LIMIT", 0, 10);
  if (ids.length === 0) return;

  for (const id of ids) {
    // Атомарно забираем запись; другой инстанс получит zrem=0 и пропустит
    const removed = await redis.zrem(QUEUE_KEY, id);
    if (removed === 0) continue;

    const raw = await redis.hgetall(`outbox:entry:${id}`);
    if (!raw?.page_id) {
      console.warn(`[outbox] entry ${id} missing in Redis, skipping`);
      continue;
    }

    const attempts = parseInt(raw.attempts ?? "0", 10) + 1;
    await redis.hset(`outbox:entry:${id}`, { attempts });

    try {
      await publishFn(
        raw.page_id,
        raw.s3_key,
        parseInt(raw.size_bytes, 10),
        parseInt(raw.ts, 10),
      );

      await redis
        .pipeline()
        .hset(`outbox:entry:${id}`, { status: "done" satisfies OutboxStatus })
        .expire(`outbox:entry:${id}`, DONE_TTL_SEC)
        .exec();

      console.log(`[outbox] published  id=${id}  page=${raw.page_id}`);
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`[outbox] publish failed  id=${id}  attempt=${attempts}/${MAX_ATTEMPTS}:`, msg);

      if (attempts >= MAX_ATTEMPTS) {
        await redis
          .pipeline()
          .hset(`outbox:entry:${id}`, { status: "failed" satisfies OutboxStatus, last_error: msg })
          .sadd(FAILED_KEY, id)
          .exec();
        console.error(`[outbox] moved to failed  id=${id}  page=${raw.page_id}`);
      } else {
        // Экспоненциальный backoff: 20с, 40с, 80с, 160с
        const delay = 20_000 * Math.pow(2, attempts - 1);
        await redis
          .pipeline()
          .hset(`outbox:entry:${id}`, { last_error: msg })
          .zadd(QUEUE_KEY, now + delay, id)
          .exec();
      }
    }
  }
}
