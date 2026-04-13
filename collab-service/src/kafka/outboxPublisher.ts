/**
 * Фоновый процесс, который читает pending-записи из Redis outbox
 * и публикует их в Kafka.
 *
 * Запускается один раз при старте сервиса.
 * Интервал опроса: OUTBOX_DRAIN_INTERVAL_MS (default 10с).
 */

import { drainOutbox }              from "./outbox";
import { publishSnapshotUploaded }  from "./producer";

const DRAIN_INTERVAL_MS = parseInt(process.env.OUTBOX_DRAIN_INTERVAL_MS ?? "10000", 10);

export function startOutboxPublisher(): void {
  setInterval(() => {
    drainOutbox(publishSnapshotUploaded).catch((err: unknown) =>
      console.error("[outbox] drain error:", (err as Error).message)
    );
  }, DRAIN_INTERVAL_MS);

  console.log(`[outbox] publisher started  interval=${DRAIN_INTERVAL_MS}ms`);
}
