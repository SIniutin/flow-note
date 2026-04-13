/**
 * Mock pages-service — in-memory gRPC сервер для локального тестирования.
 * Реализует PagesService: SaveSnapshot + GetSnapshot (server-side streaming).
 * Хранит снапшоты в Map<pageId, Buffer>.
 *
 * Запуск: node mock-pages/server.js
 */
const grpc        = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path        = require("path");
const fs          = require("fs");

const PROTO_PATH = path.resolve(__dirname, "../proto/pages.proto");
const PORT       = process.env.MOCK_PAGES_PORT ?? "50051";
const DUMP_DIR   = process.env.DUMP_DIR ?? path.join(__dirname, "snapshots");
const CHUNK_SIZE = 64 * 1024; // 64 KB per streaming chunk

if (!fs.existsSync(DUMP_DIR)) fs.mkdirSync(DUMP_DIR, { recursive: true });

const def = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
  includeDirs: [
    path.resolve(__dirname, "../proto"),
    path.resolve(__dirname, "../node_modules/google-proto-files"),
  ],
});
const proto = grpc.loadPackageDefinition(def);

// In-memory хранилище: pageId → Buffer
const store    = new Map();
let saveCount  = 0;

// Пробуем загрузить дампы с прошлого запуска
for (const file of fs.readdirSync(DUMP_DIR)) {
  if (!file.endsWith(".bin")) continue;
  const pageId = file.slice(0, -4);
  const buf    = fs.readFileSync(path.join(DUMP_DIR, file));
  store.set(pageId, buf);
  console.log(`[mock-pages] preloaded  page=${pageId}  bytes=${buf.length}`);
}

const service = {
  // ── SaveSnapshot (unary) ──────────────────────────────────────────────────
  SaveSnapshot(call, callback) {
    const { page_id, data } = call.request;
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    store.set(page_id, buf);
    saveCount++;

    const dumpPath = path.join(DUMP_DIR, `${page_id}.bin`);
    fs.writeFileSync(dumpPath, buf);
    const b64 = buf.toString("base64");

    console.log(`[mock-pages] SaveSnapshot  page=${page_id}  bytes=${buf.length}  total_saves=${saveCount}`);
    console.log(`[mock-pages] base64=${b64.slice(0, 80)}${b64.length > 80 ? "…" : ""}`);
    console.log(`[mock-pages] dump → ${dumpPath}`);

    callback(null, {});
  },

  // ── GetSnapshot (server-side streaming) ──────────────────────────────────
  // Возвращает NOT_FOUND если snapshot не найден.
  // Иначе стримит данные чанками по CHUNK_SIZE байт.
  GetSnapshot(call) {
    const { page_id } = call.request;
    const buf = store.get(page_id);

    if (!buf) {
      console.log(`[mock-pages] GetSnapshot NOT_FOUND  page=${page_id}`);
      // call.destroy() требует Error-объект; plain object игнорирует code → клиент не получает NOT_FOUND
      const err = Object.assign(new Error(`snapshot not found: ${page_id}`), {
        code: grpc.status.NOT_FOUND,
      });
      call.destroy(err);
      return;
    }

    const chunks = Math.ceil(buf.length / CHUNK_SIZE);
    console.log(`[mock-pages] GetSnapshot  page=${page_id}  bytes=${buf.length}  chunks=${chunks}`);

    for (let offset = 0; offset < buf.length; offset += CHUNK_SIZE) {
      call.write({ data: buf.slice(offset, offset + CHUNK_SIZE) });
    }
    call.end();
  },
};

const server = new grpc.Server();
server.addService(proto.pages.PagesService.service, service);

server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) { console.error("[mock-pages] bind error:", err); process.exit(1); }
  console.log(`[mock-pages] listening on :${port}`);
  console.log(`[mock-pages] snapshots dir: ${DUMP_DIR}  (${store.size} preloaded)`);
});
