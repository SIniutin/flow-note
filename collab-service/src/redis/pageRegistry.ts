import Redis from "ioredis";
import { config } from "../config";

export const redis = new Redis(config.redisUrl, {
  // Не коннектиться при импорте — ждём первого вызова.
  // Это предотвращает EAI_AGAIN если DNS контейнера ещё не готов при старте.
  lazyConnect: true,
  // ioredis уже ретраит, но явно задаём стратегию
  retryStrategy: (times) => Math.min(times * 200, 3000),
});

redis.on("error", (err) => console.error("[redis]", err));
redis.on("connect", () => console.log("[redis] connected"));

/** Регистрирует страницу на этом инстансе при первом join.
 *  NX — не перезаписывает, если уже занято другим инстансом.
 *  EX — ключ протухает через redisTtlSec если процесс упал без graceful shutdown. */
export async function registerPage(pageId: string): Promise<void> {
  await redis.set(`collab:page:${pageId}`, config.instanceAddr, "EX", config.redisTtlSec, "NX");
}

/** Обновляет TTL ключа (вызывается при периодическом flush, пока документ жив). */
export async function refreshPageTtl(pageId: string): Promise<void> {
  await redis.expire(`collab:page:${pageId}`, config.redisTtlSec);
}

/** Убирает запись при destroy (когда документ выгружается из памяти) */
export async function unregisterPage(pageId: string): Promise<void> {
  await redis.del(`collab:page:${pageId}`);
}

/** Возвращает адрес инстанса, обслуживающего страницу, или null */
export async function getPageInstance(
  pageId: string
): Promise<string | null> {
  return redis.get(`collab:page:${pageId}`);
}
