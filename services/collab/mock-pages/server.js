/**
 * Mock pages-service — in-memory gRPC сервер для локального тестирования.
 * Реализует PagesService: UpdatePageMeta.
 *
 * Запуск: node mock-pages/server.js
 */
const grpc        = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path        = require("path");

const PROTO_PATH = path.resolve(__dirname, "../proto/pages.proto");
const PORT       = process.env.MOCK_PAGES_PORT ?? "50051";

const def = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
  includeDirs: [
    path.resolve(__dirname, "../proto"),
    path.resolve(__dirname, "../node_modules/google-proto-files"),
  ],
});
const proto = grpc.loadPackageDefinition(def);

// In-memory хранилище: pageId → PageMetadataRequest
const metaStore = new Map();

const service = {
  // ── UpdatePageMeta (unary) ────────────────────────────────────────────────
  UpdatePageMeta(call, callback) {
    const { page_id, s3_key, title, content_text, word_count, mws_table_ids, snapshot_ts } = call.request;

    metaStore.set(page_id, call.request);

    console.log(`[mock-pages] UpdatePageMeta  page=${page_id}`);
    console.log(`  s3_key="${s3_key}"  title="${title}"  words=${word_count}`);
    console.log(`  tables=[${(mws_table_ids ?? []).join(", ")}]  ts=${snapshot_ts}`);
    if (content_text) {
      const preview = content_text.slice(0, 120);
      console.log(`  content="${preview}${content_text.length > 120 ? "…" : ""}"`);
    }

    callback(null, {});
  },
};

const server = new grpc.Server();
server.addService(proto.pages.PagesService.service, service);

server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) { console.error("[mock-pages] bind error:", err); process.exit(1); }
  console.log(`[mock-pages] listening on :${port}`);
});
