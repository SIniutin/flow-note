import {
  Server,
  onAuthenticatePayload,
  onConnectPayload,
  onDisconnectPayload,
  onLoadDocumentPayload,
  onStatelessPayload,
  onChangePayload,
} from "@hocuspocus/server";
import * as Y from "yjs";
import { createDocHandle, DocHandle } from "./flush/docFlusher";
import { registerPage, unregisterPage, getLastSnapshotKey } from "./redis/pageRegistry";
import { downloadByKey, ensureBucketLifecycle }  from "./storage/s3Client";
import { disconnectProducer } from "./kafka/producer";
import { startOutboxPublisher } from "./kafka/outboxPublisher";
import { loadTable, hasTable } from "./mws/tableRegistry";
import { MwsUnavailableError } from "./mws/mwsClient";
import { handleTblOp, TblOpMessage } from "./handlers/tblOpHandler";
import { startRoutingServer } from "./routingServer";
import { verifyToken } from "./auth/jwtVerifier";
import { startTableGrpcServer } from "./grpc/tableServer";

import { config } from "./config";

// page_id → DocHandle (ссылка на hocuspocus Y.Doc + flush-таймеры)
const docs = new Map<string, DocHandle>();

// page_id → Set<dst_id> — кеш dst_id всех mws_table-блоков документа
const docTableIds = new Map<string, Set<string>>();

// page_id → функция отписки от observeDeep
const docObservers = new Map<string, () => void>();

// Флаг graceful shutdown — onAuthenticate отклоняет новые соединения
let shuttingDown = false;
let tableGrpcServer: import("@grpc/grpc-js").Server | null = null;

interface ConnContext {
  token: string;
  userId: string;
  socketId: string;
}

const server = Server.configure({
  port:    config.port,
  timeout: config.wsTimeout,

  // ── onAuthenticate ───────────────────────────────────────────────────────────
  async onAuthenticate({ token, context, socketId, documentName }: onAuthenticatePayload) {
    if (shuttingDown) {
      throw new Error("Server is shutting down");
    }
    console.log(`[auth] socket=${socketId}  doc=${documentName}  token=${token ? `"${token.slice(0, 8)}…"` : "MISSING"}`);
    if (!token) {
      console.warn(`[auth] REJECTED socket=${socketId} — no token`);
      throw new Error("Unauthorized");
    }

    let userId: string;
    try {
      ({ userId } = verifyToken(token));
    } catch (err) {
      console.warn(`[auth] REJECTED socket=${socketId}: ${(err as Error).message}`);
      throw new Error("Unauthorized: invalid token");
    }

    (context as ConnContext).token    = token;
    (context as ConnContext).userId   = userId;
    (context as ConnContext).socketId = socketId;
    console.log(`[auth] OK  socket=${socketId}  user=${userId}`);
  },

  // ── onLoadDocument ───────────────────────────────────────────────────────────
  async onLoadDocument({ documentName, context, document, socketId }: onLoadDocumentPayload) {
    const pageId = documentName;
    const { token } = context as ConnContext;
    const isFirstLoad = !docs.has(pageId);

    console.log(`[doc] onLoadDocument  page=${pageId}  socket=${socketId}  firstLoad=${isFirstLoad}`);

    if (isFirstLoad) {
      // 1. Восстанавливаем Y.Doc из последнего snapshot в S3
      try {
        const s3Key = await getLastSnapshotKey(pageId);
        if (s3Key) {
          const blob = await downloadByKey(s3Key);
          if (blob) {
            Y.applyUpdate(document, blob);
            console.log(`[doc] snapshot restored  page=${pageId}  key=${s3Key}  bytes=${blob.byteLength}`);
          } else {
            console.log(`[doc] snapshot key found but object missing  page=${pageId}  key=${s3Key}`);
          }
        } else {
          console.log(`[doc] no snapshot — new document  page=${pageId}`);
        }
      } catch (err) {
        console.error(`[doc] restore failed — starting empty  page=${pageId}:`, (err as Error).message);
      }

      // 2. Регистрируем handle; onDestroy вызывается синхронно в начале destroy()
      const handle = createDocHandle(pageId, document, (id) => {
        docs.delete(id);
        docTableIds.delete(id);
        docObservers.get(id)?.();
        docObservers.delete(id);
        unregisterPage(id).catch((e: unknown) =>
          console.error(`[registry] unregister failed  page=${id}:`, e)
        );
      });
      docs.set(pageId, handle);
      console.log(`[doc] handle created  page=${pageId}`);

      // 3. Первичное сканирование XmlFragment на mws_table блоки
      const content = document.get("content", Y.XmlFragment);
      const knownIds = new Set(extractMwsTableDstIds(content));
      docTableIds.set(pageId, knownIds);

      if (knownIds.size > 0) {
        console.log(`[doc] mws tables found  page=${pageId}  tables=[${[...knownIds].join(", ")}]`);
        await Promise.allSettled(
          [...knownIds].map((dstId) =>
            loadTable(dstId, token).catch((e: unknown) => {
              console.error(`[mws] load table failed  dst=${dstId}:`, e);
              if (e instanceof MwsUnavailableError) {
                document.broadcastStateless(
                  JSON.stringify({ type: "tbl_unavailable", dst_id: dstId })
                );
              }
            })
          )
        );
      }

      // 4. Подписка на изменения фрагмента — подгружаем НОВЫЕ таблицы по мере добавления
      function onContentChange(): void {
        const allIds = extractMwsTableDstIds(content);
        const newIds = allIds.filter((id) => !knownIds.has(id));
        if (newIds.length === 0) return;

        newIds.forEach((id) => knownIds.add(id));
        console.log(`[mws] lazy load new tables  page=${pageId}  tables=[${newIds.join(", ")}]`);
        Promise.allSettled(
          newIds.map((dstId) =>
            loadTable(dstId, token).catch((e: unknown) => {
              console.error(`[mws] lazy load failed  dst=${dstId}:`, e);
              if (e instanceof MwsUnavailableError) {
                document.broadcastStateless(
                  JSON.stringify({ type: "tbl_unavailable", dst_id: dstId })
                );
              }
            })
          )
        );
      }

      content.observeDeep(onContentChange);
      docObservers.set(pageId, () => content.unobserveDeep(onContentChange));

      // 5. Регистрируем страницу в Redis (только при первом load)
      await registerPage(pageId).catch((err: unknown) =>
        console.error(`[registry] register failed  page=${pageId}:`, err)
      );
    }
  },

  // ── onConnect ────────────────────────────────────────────────────────────────
  async onConnect({ documentName, socketId }: onConnectPayload) {
    console.log(`[ws] CONNECT  page=${documentName}  socket=${socketId}`);
  },

  // ── onDisconnect ─────────────────────────────────────────────────────────────
  async onDisconnect({ documentName, socketId, clientsCount }: onDisconnectPayload) {
    console.log(`[ws] DISCONNECT  page=${documentName}  socket=${socketId}  remaining=${clientsCount}`);
  },

  // ── onChange ─────────────────────────────────────────────────────────────────
  // Обнаружение новых таблиц перенесено в observeDeep (content.observeDeep).
  async onChange({ documentName, clientsCount, context, update }: onChangePayload) {
    const socket = (context as ConnContext)?.socketId ?? "?";
    console.log(`[sync] onChange  page=${documentName}  from=${socket}  clients=${clientsCount}  bytes=${update.byteLength}`);
  },

  // ── onStateless ──────────────────────────────────────────────────────────────
  async onStateless({ payload, document, connection, documentName }: onStatelessPayload) {
    const socket = (connection.context as ConnContext)?.socketId ?? "?";
    console.log(`[stateless] IN  page=${documentName}  from=${socket}  payload=${payload.slice(0, 120)}`);

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      console.warn(`[stateless] invalid JSON  socket=${socket}`);
      return;
    }

    const token = (connection.context as ConnContext)?.token ?? "";

    function broadcast(data: unknown): void {
      const raw = JSON.stringify(data);
      console.log(`[stateless] BROADCAST  page=${documentName}  payload=${raw.slice(0, 120)}`);
      document.broadcastStateless(raw);
    }

    switch (msg.type) {
      case "tbl_op":
        handleTblOp(msg as unknown as TblOpMessage, token, broadcast);
        break;
      case "tbl_aw":
        broadcast(msg);
        break;
      case "tbl_rollback":
        console.warn(`[stateless] client sent tbl_rollback (server-only)  socket=${socket}`);
        break;
      default:
        console.warn(`[stateless] unknown type="${msg.type}"  socket=${socket}`);
    }
  },

  extensions: [],
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractMwsTableDstIds(root: Y.XmlFragment): string[] {
  const ids = new Set<string>();
  root.toArray().forEach((child) => {
    if (!(child instanceof Y.XmlElement)) return;
    if (child.nodeName === "mws_table") {
      const dstId = child.getAttribute("dst_id");
      if (typeof dstId === "string" && dstId.length > 0) ids.add(dstId);
    }
    extractMwsTableDstIds(child as unknown as Y.XmlFragment).forEach((id) => ids.add(id));
  });
  return [...ids];
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  shuttingDown = true;
  console.log(`[shutdown] ${signal} — flushing ${docs.size} docs…`);

  await Promise.allSettled(
    Array.from(docs.values()).map((h) =>
      h.destroy().catch((err: unknown) => console.error("[shutdown] flush error:", err))
    )
  );

  await disconnectProducer().catch((err: unknown) =>
    console.error("[shutdown] kafka disconnect error:", err)
  );

  await new Promise<void>((resolve) => {
    if (!tableGrpcServer) {
      resolve();
      return;
    }
    tableGrpcServer.tryShutdown((err) => {
      if (err) {
        console.error("[shutdown] grpc shutdown error:", err);
      }
      resolve();
    });
  });

  await server.destroy().catch((err: unknown) =>
    console.error("[shutdown] server.destroy error:", err)
  );

  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("[process] unhandledRejection:", reason);
});

async function init(): Promise<void> {
  await ensureBucketLifecycle();
  startOutboxPublisher();
  startRoutingServer();
  tableGrpcServer = await startTableGrpcServer();
  await server.listen();
  console.log(`[collab] hocuspocus listening on :${config.port}`);
}

init().catch((err) => {
  console.error("[collab] startup failed:", err);
  process.exit(1);
});
