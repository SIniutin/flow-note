import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";
import * as Y from "yjs";
import { config } from "../config";

const PROTO_PATH = path.resolve(__dirname, "../../proto/pages.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [
    path.resolve(__dirname, "../../proto"),
    path.resolve(__dirname, "../../node_modules/google-proto-files"),
  ],
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const proto = grpc.loadPackageDefinition(packageDefinition) as any;

const client = new proto.pages.PagesService(
  config.pagesGrpcAddr,
  grpc.credentials.createInsecure()
);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── GetSnapshot ───────────────────────────────────────────────────────────────

/**
 * Загружает последний Y.Doc snapshot из pages-service (server-side streaming).
 * Возвращает Uint8Array если snapshot найден, null если страница новая (NOT_FOUND).
 * Не ретраит — при недоступности pages поднимаем пустой документ.
 */
export function getSnapshot(pageId: string): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + config.snapshotTimeoutMs);

    const call = client.GetSnapshot(
      { page_id: pageId },
      { deadline }
    );
    const chunks: Buffer[] = [];

    call.on("data", (chunk: { data: Buffer }) => {
      chunks.push(Buffer.isBuffer(chunk.data) ? chunk.data : Buffer.from(chunk.data));
    });

    call.on("end", () => {
      const total = Buffer.concat(chunks);
      resolve(total.length > 0 ? new Uint8Array(total) : null);
    });

    call.on("error", (err: grpc.ServiceError) => {
      if (
        err.code === grpc.status.NOT_FOUND ||
        err.code === grpc.status.DEADLINE_EXCEEDED
      ) {
        // NOT_FOUND  → новая страница, снапшота нет
        // DEADLINE_EXCEEDED → pages-service недоступен, поднимаем пустой документ
        resolve(null);
      } else {
        reject(err);
      }
    });
  });
}

// ── SaveSnapshot ──────────────────────────────────────────────────────────────

/**
 * Сохраняет snapshot в pages-service с retry + exponential backoff.
 * Возвращает true при успехе (можно чистить Redis), false при исчерпании попыток.
 */
export async function storeSnapshot(
  pageId: string,
  docOrBlob: Y.Doc | Uint8Array
): Promise<boolean> {
  const data = Buffer.from(
    docOrBlob instanceof Y.Doc ? Y.encodeStateAsUpdate(docOrBlob) : docOrBlob
  );

  for (let attempt = 1; attempt <= config.grpcFlushAttempts; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        client.SaveSnapshot(
          { page_id: pageId, data },
          (err: grpc.ServiceError | null) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      return true;
    } catch (err) {
      const delay = config.grpcFlushBaseDelayMs * Math.pow(2, attempt - 1);
      console.error(
        `[grpc] SaveSnapshot failed  page=${pageId}  attempt=${attempt}/${config.grpcFlushAttempts}:`,
        (err as Error).message
      );
      if (attempt < config.grpcFlushAttempts) await sleep(delay);
    }
  }

  console.error(`[grpc] SaveSnapshot exhausted attempts  page=${pageId}`);
  return false;
}
