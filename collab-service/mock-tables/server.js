/**
 * Mock MWS Tables API — HTTP-сервер для локального тестирования.
 * Реализует подмножество FUSION-API v1:
 *   GET  /fusion/v1/datasheets/:dstId/records  → список записей
 *   PATCH /fusion/v1/datasheets/:dstId/records → обновление записей
 *
 * Запуск: node mock-tables/server.js
 * По умолчанию порт 8080, можно задать через MOCK_TABLES_PORT.
 */
const http = require("http");
const url  = require("url");

const PORT = parseInt(process.env.MOCK_TABLES_PORT ?? "8080", 10);

// ── In-memory хранилище ──────────────────────────────────────────────────────
// dst_id → Map<recordId, { [fieldId]: value }>
const tables = new Map();

// Засеиваем тестовые данные — два датасита с несколькими записями
function seed() {
  const dst1 = new Map([
    ["rec001", { fld_title: "Задача А", fld_status: "todo",  fld_priority: 1 }],
    ["rec002", { fld_title: "Задача Б", fld_status: "done",  fld_priority: 2 }],
    ["rec003", { fld_title: "Задача В", fld_status: "inprogress", fld_priority: 3 }],
  ]);
  const dst2 = new Map([
    ["rec101", { fld_name: "Иван",  fld_score: 42 }],
    ["rec102", { fld_name: "Мария", fld_score: 88 }],
  ]);
  tables.set("dst_mock_001", dst1);
  tables.set("dst_mock_002", dst2);
  console.log(`[mock-tables] seeded dst_mock_001 (${dst1.size} records), dst_mock_002 (${dst2.size} records)`);
}
seed();

// ── Helpers ──────────────────────────────────────────────────────────────────

function ok(res, data) {
  const body = JSON.stringify({ success: true, code: 200, message: "SUCCESS", data });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(body);
}

function fail(res, status, message) {
  const body = JSON.stringify({ success: false, code: status, message });
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end",  () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}")); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

// GET /fusion/v1/datasheets/:dstId/records
function handleGetRecords(req, res, dstId) {
  const parsed  = url.parse(req.url, true);
  const fieldKey = parsed.query.fieldKey ?? "id"; // "id" | "name" — мок всегда хранит по id

  let records = tables.get(dstId);
  if (!records) {
    // Создаём пустой датасит на лету
    records = new Map();
    tables.set(dstId, records);
    console.log(`[mock-tables] GET  dst=${dstId}  auto-created empty datasheet`);
  }

  const out = Array.from(records.entries()).map(([recordId, fields]) => ({
    recordId,
    fields,
    createdAt: 1700000000000,
    updatedAt: Date.now(),
  }));

  console.log(`[mock-tables] GET  dst=${dstId}  records=${out.length}  fieldKey=${fieldKey}`);
  ok(res, {
    pageNum:  1,
    pageSize: out.length,
    total:    out.length,
    records:  out,
  });
}

// PATCH /fusion/v1/datasheets/:dstId/records
async function handlePatchRecords(req, res, dstId) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return fail(res, 400, "invalid JSON body");
  }

  const { records, fieldKey = "id" } = body;
  if (!Array.isArray(records) || records.length === 0) {
    return fail(res, 400, "records array is required");
  }

  let tableRecords = tables.get(dstId);
  if (!tableRecords) {
    tableRecords = new Map();
    tables.set(dstId, tableRecords);
  }

  const updated = [];
  for (const { recordId, fields } of records) {
    if (!recordId || typeof fields !== "object") continue;
    const existing = tableRecords.get(recordId) ?? {};
    const merged   = { ...existing, ...fields };
    tableRecords.set(recordId, merged);
    updated.push({ recordId, fields: merged, createdAt: 1700000000000, updatedAt: Date.now() });
    console.log(`[mock-tables] PATCH  dst=${dstId}  rec=${recordId}  fields=${JSON.stringify(fields)}  fieldKey=${fieldKey}`);
  }

  ok(res, { records: updated });
}

// ── Router ───────────────────────────────────────────────────────────────────
// Принимает как /fusion/v1/... так и /api/v1/... — чтобы работать с любым MWS_API_BASE
const RECORDS_RE = /^(?:\/fusion|\/api)?\/v1\/datasheets\/([^/]+)\/records(?:\?.*)?$/;

const server = http.createServer(async (req, res) => {
  const pathname = url.parse(req.url).pathname;
  const match    = pathname.match(RECORDS_RE);

  if (!match) {
    console.log(`[mock-tables] 404  ${req.method} ${req.url}`);
    return fail(res, 404, `unknown path: ${pathname}`);
  }

  const dstId = match[1];
  const auth  = req.headers.authorization ?? "(none)";
  console.log(`[mock-tables] ${req.method} ${pathname}  dst=${dstId}  auth=${auth.slice(0, 20)}…`);

  if (req.method === "GET")        return handleGetRecords(req, res, dstId);
  if (req.method === "PATCH")      return handlePatchRecords(req, res, dstId);

  fail(res, 405, `method ${req.method} not allowed`);
});

server.listen(PORT, () => {
  console.log(`[mock-tables] listening on :${PORT}`);
  console.log(`[mock-tables] endpoints:`);
  console.log(`  GET  http://localhost:${PORT}/fusion/v1/datasheets/:dstId/records`);
  console.log(`  PATCH http://localhost:${PORT}/fusion/v1/datasheets/:dstId/records`);
  console.log(`[mock-tables] pre-seeded: dst_mock_001, dst_mock_002`);
  console.log(`[mock-tables] set MWS_API_BASE=http://localhost:${PORT}/fusion/v1 in collab-service`);
});
