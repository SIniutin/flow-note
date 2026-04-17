import * as Y from "yjs";
import { encodeStateAsUpdate } from "yjs";
import { uploadSnapshot }                    from "../storage/s3Client";
import { enqueueOutbox }                      from "../kafka/outbox";
import { refreshPageTtl, setLastSnapshotKey } from "../redis/pageRegistry";
import { config } from "../config";

export interface DocHandle {
  /** Ссылка на Y.Doc которым управляет hocuspocus для этой страницы */
  doc: Y.Doc;
  destroy: () => Promise<void>;
}

/**
 * Создаёт DocHandle вокруг уже существующего Y.Doc (hocuspocus document).
 * Не создаёт новый Y.Doc — использует тот, что пришёл из onLoadDocument.
 *
 * Flush pipeline:
 *   1. Y.encodeStateAsUpdate(doc)  → blob
 *   2. S3 uploadSnapshot           → s3_key
 *   3. Kafka publishSnapshotUploaded (fire-and-forget после S3)
 */
export function createDocHandle(
  pageId: string,
  doc: Y.Doc,
  onDestroy: (pageId: string) => void
): DocHandle {
  let isDirty = false;

  async function flush(force = false): Promise<boolean> {
    if (!isDirty && !force) {
      console.log(`[flush] skip — no changes  page=${pageId}`);
      return true;
    }
    isDirty = false;

    const blob = encodeStateAsUpdate(doc);

    let s3Key: string;
    for (let attempt = 1; attempt <= config.grpcFlushAttempts; attempt++) {
      try {
        s3Key = await uploadSnapshot(pageId, blob);
        break;
      } catch (err) {
        const delay = config.grpcFlushBaseDelayMs * Math.pow(2, attempt - 1);
        console.error(
          `[flush] S3 upload failed  page=${pageId}  attempt=${attempt}/${config.grpcFlushAttempts}:`,
          (err as Error).message
        );
        if (attempt === config.grpcFlushAttempts) return false;
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    console.log(`[flush] uploaded to S3  page=${pageId}  key=${s3Key!}  bytes=${blob.byteLength}`);

    // Сохраняем ключ в Redis — onLoadDocument использует его вместо ListObjectsV2
    await setLastSnapshotKey(pageId, s3Key!).catch((e: unknown) =>
      console.warn(`[flush] setLastSnapshotKey failed  page=${pageId}:`, (e as Error).message)
    );

    // Запись в outbox → надёжная доставка в Kafka через outboxPublisher
    await enqueueOutbox(pageId, s3Key!, blob.byteLength, Date.now()).catch((e: unknown) =>
      console.warn(`[flush] outbox enqueue failed  page=${pageId}:`, (e as Error).message)
    );

    return true;
  }

  const flushTimer = setInterval(() => {
    flush().then((ok) => {
      if (!ok) {
        console.warn(`[flush] periodic flush gave up for ${pageId}`);
      } else {
        refreshPageTtl(pageId).catch((e) =>
          console.error(`[flush] TTL refresh failed  page=${pageId}:`, e)
        );
      }
    });
  }, config.flushIntervalMs);

  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  function onUpdate(): void {
    isDirty = true;
    resetIdle();
  }

  function resetIdle(): void {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      handle.destroy().catch((err) =>
        console.error(`[flush] idle destroy failed for ${pageId}:`, err)
      );
    }, config.docIdleMs);
  }

  doc.on("update", onUpdate);

  const handle: DocHandle = {
    doc,

    async destroy(): Promise<void> {
      clearInterval(flushTimer);
      if (idleTimer) clearTimeout(idleTimer);
      doc.off("update", onUpdate);

      // Немедленно убираем из реестра — новое подключение создаст свежий handle
      onDestroy(pageId);

      console.log(`[flush] final flush  page=${pageId}`);
      const ok = await flush(true); // force=true — флашим даже если isDirty=false
      if (!ok) {
        console.error(`[flush] final flush failed  page=${pageId}`);
      }
      // doc.destroy() НЕ вызываем — Y.Doc принадлежит hocuspocus
    },
  };

  resetIdle();
  return handle;
}
