import * as Y from "yjs";
import { encodeStateAsUpdate } from "yjs";
import { storeSnapshot } from "../grpc/pagesClient";
import { refreshPageTtl } from "../redis/pageRegistry";
import { config } from "../config";

export interface DocHandle {
  /** Ссылка на Y.Doc которым управляет hocuspocus для этой страницы */
  doc: Y.Doc;
  destroy: () => Promise<void>;
}

/**
 * Создаёт DocHandle вокруг уже существующего Y.Doc (hocuspocus document).
 * Не создаёт новый Y.Doc — использует тот, что пришёл из onLoadDocument.
 */
export function createDocHandle(
  pageId: string,
  doc: Y.Doc,
  onDestroy: (pageId: string) => void
): DocHandle {
  async function flush(): Promise<boolean> {
    const blob = encodeStateAsUpdate(doc);
    return storeSnapshot(pageId, blob);
  }

  const flushTimer = setInterval(() => {
    flush().then((ok) => {
      if (!ok) {
        console.warn(`[flush] periodic flush gave up for ${pageId}`);
      } else {
        console.log(`[flush] periodic flush ok  page=${pageId}  bytes=${encodeStateAsUpdate(doc).byteLength}`);
        // Продлеваем TTL Redis-ключа пока документ жив — защита от "зависших" ключей при краше
        refreshPageTtl(pageId).catch((e) =>
          console.error(`[flush] TTL refresh failed  page=${pageId}:`, e)
        );
      }
    });
  }, config.flushIntervalMs);

  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  function resetIdle(): void {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      handle.destroy().catch((err) =>
        console.error(`[flush] idle destroy failed for ${pageId}:`, err)
      );
    }, config.docIdleMs);
  }

  doc.on("update", resetIdle);

  const handle: DocHandle = {
    doc,

    async destroy(): Promise<void> {
      clearInterval(flushTimer);
      if (idleTimer) clearTimeout(idleTimer);
      doc.off("update", resetIdle);

      // Немедленно убираем из реестра — новое подключение к той же странице
      // увидит isFirstLoad=true и создаст свежий handle, избегая гонки двойных таймеров.
      onDestroy(pageId);

      console.log(`[flush] final flush  page=${pageId}`);
      const ok = await flush();
      if (!ok) {
        console.error(`[flush] final flush failed  page=${pageId}`);
      }
      // doc.destroy() НЕ вызываем — Y.Doc принадлежит hocuspocus.
      // Вызов destroy() на чужом документе корраптит его для последующих подключений.
    },
  };

  resetIdle();
  return handle;
}
