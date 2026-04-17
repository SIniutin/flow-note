import { config } from "../config";
import { PageMetadata } from "../parser/ydocParser";

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (config.pagesAuthToken) {
    headers.authorization = `Bearer ${config.pagesAuthToken}`;
  }

  return headers;
}

async function httpCall(method: string, url: string, payload?: object): Promise<void> {
  const res = await fetch(new URL(url, config.pagesHttpAddr), {
    method,
    headers: buildHeaders(),
    body: payload ? JSON.stringify(payload) : undefined,
  });

  if (res.ok) return;

  const text = await res.text();
  throw new Error(`${res.status} ${res.statusText}: ${text || "request failed"}`);
}

/**
 * Парсит key_to_snapshot из полного S3-ключа.
 * Формат ключа: snapshots/{pageId}/{key_to_snapshot}.bin
 * Возвращает только {key_to_snapshot} — имя файла без расширения.
 */
function parseSnapshotKey(s3Key: string): string {
  const filename = s3Key.split("/").at(-1) ?? s3Key;
  return filename.endsWith(".bin") ? filename.slice(0, -4) : filename;
}

async function updatePage(pageId: string, meta: PageMetadata, sizeBytes: number, snapshotKey: string): Promise<void> {
  const title = meta.title.trim();
  if (!title) return;

  await httpCall("PATCH", `/v1/pages/${pageId}`, {
    page_id: pageId,
    title,
    size: sizeBytes,
    key_to_snapshot: parseSnapshotKey(snapshotKey),
  });
}

/**
 * Синхронизирует title и извлечённые из snapshot связи страницы с pages-service.
 * Использует HTTP gateway page-service, чтобы meta-parser не держал локальные proto.
 */
export async function replacePageRelations(
  pageId: string,
  meta: PageMetadata,
  snapshot: { sizeBytes: number; snapshotKey: string },
): Promise<void> {
  await Promise.all([
    updatePage(pageId, meta, snapshot.sizeBytes, snapshot.snapshotKey),
    httpCall("POST", "/pages.v1.PagesService/ReplacePageLinks", {
      page_id: pageId,
      links: meta.links.map((link) => ({
        to_page_id: link.toPageId,
        block_id: link.blockId,
      })),
    }),
    httpCall("POST", "/pages.v1.PagesService/ReplacePageMentions", {
      page_id: pageId,
      mentions: meta.mentions.map((mention) => ({
        user_id: mention.userId,
        block_id: mention.blockId,
      })),
    }),
    httpCall("POST", "/pages.v1.PagesService/ReplacePageTables", {
      page_id: pageId,
      tables: meta.tables.map((table) => ({
        dst_id: table.dstId,
        block_id: table.blockId,
      })),
    }),
    httpCall("POST", "/pages.v1.PagesService/ReplacePageMedia", {
      page_id: pageId,
      media: [],
    }),
  ]);
}
