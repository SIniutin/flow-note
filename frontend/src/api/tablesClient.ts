// ─── src/api/tablesClient.ts ──────────────────────────────────────────────────
// Клиент MWS Tables.
// Вызывает реальный API: GET/PATCH /fusion/v1/datasheets/:dstId/records
// (проксируется через vite → mock-tables сервер или реальный MWS API).
//
// Структура ответа MWS Fusion API:
//   { success, code, message, data: { records: [{ recordId, fields }] } }
//
// Для listTables() / searchTables() используем локальный catalog (seed),
// т.к. MWS API не имеет /datasheets/list endpoint.
// Строки таблицы загружаются реально через API.

import type { MwsTable, MwsColumn, MwsRow } from "../types/mwsTable";
import { getAccessToken } from "../data/authStore";
import { collabClient } from "./collabClient";

// ── Catalog (metadata without rows) ──────────────────────────────────────────
// Хранит схему колонок и метаданные таблиц. Строки всегда идут из API.

interface TableMeta {
    id:          string;
    name:        string;
    description: string;
    icon:        string;
    columns:     MwsColumn[];
}

// ── Custom tables (localStorage) ──────────────────────────────────────────────

const CUSTOM_TABLES_KEY = "mws_custom_tables_v1";

function loadCustomTables(): TableMeta[] {
    try {
        const raw = localStorage.getItem(CUSTOM_TABLES_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as TableMeta[];
    } catch {
        return [];
    }
}

function saveCustomTables(list: TableMeta[]): void {
    try {
        localStorage.setItem(CUSTOM_TABLES_KEY, JSON.stringify(list));
    } catch { /* ignore */ }
}

const customTables: TableMeta[] = loadCustomTables();

// Catalog таблиц: id → meta. При интеграции с реальным MWS заменить на GET /datasheets.
const CATALOG: TableMeta[] = [
    {
        id: "tbl_roadmap", name: "Product Roadmap",
        description: "Бэклог Q2–Q3 и статусы поставки", icon: "🗺️",
        columns: [
            { id: "col_title",  name: "Название",      type: "text",    width: 240 },
            { id: "col_status", name: "Статус",         type: "select",  width: 120 },
            { id: "col_owner",  name: "Ответственный",  type: "text",    width: 140 },
            { id: "col_eta",    name: "ETA",             type: "date",    width: 120 },
            { id: "col_done",   name: "Готово",          type: "boolean", width: 80  },
        ],
    },
    {
        id: "tbl_team", name: "Team Directory",
        description: "Контакты и роли инженерного отдела", icon: "👥",
        columns: [
            { id: "col_name",  name: "Имя",    type: "text",   width: 180 },
            { id: "col_role",  name: "Роль",   type: "text",   width: 180 },
            { id: "col_team",  name: "Команда", type: "select", width: 140 },
            { id: "col_email", name: "Email",  type: "url",    width: 220 },
        ],
    },
    {
        id: "tbl_bugs", name: "Bug Tracker",
        description: "Открытые баги текущего спринта", icon: "🐛",
        columns: [
            { id: "col_id",       name: "#",         type: "number", width: 60  },
            { id: "col_title",    name: "Название",  type: "text",   width: 260 },
            { id: "col_sev",      name: "Severity",  type: "select", width: 110 },
            { id: "col_assignee", name: "Assignee",  type: "text",   width: 140 },
            { id: "col_url",      name: "Issue URL", type: "url",    width: 200 },
        ],
    },
    {
        id: "tbl_okrs", name: "OKRs Q2 2025",
        description: "Цели и ключевые результаты квартала", icon: "🎯",
        columns: [
            { id: "col_obj",   name: "Цель",              type: "text",   width: 260 },
            { id: "col_kr",    name: "Ключевой результат", type: "text",   width: 260 },
            { id: "col_prog",  name: "Прогресс %",         type: "number", width: 110 },
            { id: "col_owner", name: "Ответственный",      type: "text",   width: 130 },
        ],
    },
];

// ── Seed rows fallback (когда API недоступен) ─────────────────────────────────
// При запущенном mock-tables сервере (npm run mock:tables в collab-service) строки
// грузятся по API. Здесь — только fallback.

const SEED_ROWS: Record<string, Array<{ id: string; cells: Record<string, string | number | boolean | null> }>> = {
    tbl_roadmap: [
        { id: "r1", cells: { col_title: "Тёмная тема",    col_status: "In Progress", col_owner: "Алиса",  col_eta: "2025-06-15", col_done: false } },
        { id: "r2", cells: { col_title: "Экспорт PDF",     col_status: "Planned",    col_owner: "Боб",    col_eta: "2025-07-01", col_done: false } },
        { id: "r3", cells: { col_title: "Офлайн-режим",    col_status: "Done",       col_owner: "Карол",  col_eta: "2025-05-20", col_done: true  } },
        { id: "r4", cells: { col_title: "Realtime collab", col_status: "Planned",    col_owner: "Дэн",    col_eta: "2025-08-01", col_done: false } },
    ],
    tbl_team: [
        { id: "r1", cells: { col_name: "Алиса Ковальски",  col_role: "Senior Frontend", col_team: "Platform", col_email: "alice@example.com" } },
        { id: "r2", cells: { col_name: "Боб Мюллер",       col_role: "Backend Lead",    col_team: "Core",     col_email: "bob@example.com"   } },
        { id: "r3", cells: { col_name: "Карол Танака",      col_role: "Product Manager", col_team: "Platform", col_email: "carol@example.com" } },
        { id: "r4", cells: { col_name: "Дэн Оби",           col_role: "Designer",        col_team: "Design",   col_email: "dan@example.com"   } },
    ],
    tbl_bugs: [
        { id: "r1", cells: { col_id: 1042, col_title: "Краш при вставке из Google Docs",                col_sev: "Critical", col_assignee: "Алиса", col_url: "https://github.com/org/repo/issues/1042" } },
        { id: "r2", cells: { col_id: 1051, col_title: "z-index конфликт Mention dropdown",              col_sev: "Medium",   col_assignee: "Боб",   col_url: "https://github.com/org/repo/issues/1051" } },
        { id: "r3", cells: { col_id: 1060, col_title: "Slash-меню не закрывается на Escape в Safari",   col_sev: "Low",      col_assignee: "Карол", col_url: "https://github.com/org/repo/issues/1060" } },
    ],
    tbl_okrs: [
        { id: "r1", cells: { col_obj: "Выпустить wiki-редактор v1", col_kr: "TipTap-интеграция готова",  col_prog: 80, col_owner: "Алиса" } },
        { id: "r2", cells: { col_obj: "Выпустить wiki-редактор v1", col_kr: "Realtime collab в staging", col_prog: 30, col_owner: "Боб"   } },
        { id: "r3", cells: { col_obj: "Улучшить онбординг",         col_kr: "Time-to-first-doc < 2 мин", col_prog: 55, col_owner: "Карол" } },
    ],
};

// ── MWS Fusion API helpers ────────────────────────────────────────────────────

interface FusionRecord {
    recordId: string;
    fields:   Record<string, unknown>;
}

interface FusionResponse {
    success: boolean;
    code:    number;
    message: string;
    data?:   { records?: FusionRecord[]; pageNum?: number; total?: number };
}

function authHeaders(): Record<string, string> {
    const token = getAccessToken();
    return token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" };
}

async function fetchRecords(dstId: string): Promise<FusionRecord[]> {
    const res = await fetch(`/fusion/v1/datasheets/${dstId}/records`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`MWS API ${res.status} for ${dstId}`);
    const json: FusionResponse = await res.json();
    if (!json.success) throw new Error(json.message || "MWS API error");
    return json.data?.records ?? [];
}

async function patchRecords(dstId: string, records: FusionRecord[]): Promise<void> {
    const res = await fetch(`/fusion/v1/datasheets/${dstId}/records`, {
        method:  "PATCH",
        headers: authHeaders(),
        body:    JSON.stringify({ records }),
    });
    if (!res.ok) throw new Error(`MWS PATCH ${res.status} for ${dstId}`);
}

// ── Row mapping: Fusion ↔ MwsTable ───────────────────────────────────────────

function fusionToRows(
    records: FusionRecord[],
    columns: MwsColumn[],
): MwsRow[] {
    return records.map(rec => {
        const cells: Record<string, string | number | boolean | null> = {};
        columns.forEach(col => {
            const v = rec.fields[col.id] ?? rec.fields[col.name];
            if (v !== undefined && v !== null) {
                cells[col.id] = v as string | number | boolean | null;
            }
        });
        if (Object.keys(cells).length === 0) {
            const fieldKeys = Object.keys(rec.fields);
            columns.forEach((col, i) => {
                const raw = rec.fields[fieldKeys[i]];
                if (raw != null) cells[col.id] = raw as string | number | boolean;
            });
        }
        return { id: rec.recordId, cells };
    });
}

// ── TTL cache ─────────────────────────────────────────────────────────────────

const CACHE_TTL = 30_000;

interface CacheEntry { table: MwsTable; expiresAt: number; }
const tableCache = new Map<string, CacheEntry>();

function cacheGet(id: string): MwsTable | null {
    const e = tableCache.get(id);
    if (!e) return null;
    if (Date.now() > e.expiresAt) { tableCache.delete(id); return null; }
    return e.table;
}

function cacheSet(table: MwsTable): void {
    tableCache.set(table.id, { table, expiresAt: Date.now() + CACHE_TTL });
}

// ── public API ────────────────────────────────────────────────────────────────

export const tablesClient = {
    /** Список всех таблиц без строк (catalog + пользовательские) */
    async listTables(): Promise<Omit<MwsTable, "rows">[]> {
        return [...CATALOG, ...customTables].map(({ id, name, description, icon, columns }) => ({
            id, name, description, icon, columns,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }));
    },

    /** Одна таблица со строками — TTL кэш → collab-service → MWS → seed fallback */
    async getTable(id: string): Promise<MwsTable | null> {
        const cached = cacheGet(id);
        if (cached) return cached;

        const meta = CATALOG.find(c => c.id === id) ?? customTables.find(c => c.id === id);
        if (!meta) return null;

        let rows: MwsRow[];
        try {
            // collab-service — единый источник для realtime состояния строк.
            // Если таблица загружена в tableRegistry, возвращаем оттуда.
            const collabRows = await collabClient.getTableRows(id);
            if (collabRows !== null && collabRows.length > 0) {
                rows = collabRows;
            } else {
                // Fallback: MWS Fusion API (таблица ещё не загружена в collab-service)
                const records = await fetchRecords(id);
                rows = records.length > 0
                    ? fusionToRows(records, meta.columns)
                    : (SEED_ROWS[id] ?? []);
            }
        } catch (e) {
            console.warn(`[tablesClient] API unavailable for ${id}, using seed:`, e);
            rows = SEED_ROWS[id] ?? [];
        }

        const table: MwsTable = {
            id:          meta.id,
            name:        meta.name,
            description: meta.description,
            icon:        meta.icon,
            columns:     meta.columns,
            rows,
            createdAt:   new Date().toISOString(),
            updatedAt:   new Date().toISOString(),
        };
        cacheSet(table);
        return table;
    },

    /** Поиск по имени / описанию (catalog + пользовательские) */
    async searchTables(query: string): Promise<Omit<MwsTable, "rows">[]> {
        const q = query.toLowerCase();
        return [...CATALOG, ...customTables].filter(t =>
            t.name.toLowerCase().includes(q) ||
            (t.description ?? "").toLowerCase().includes(q),
        ).map(({ id, name, description, icon, columns }) => ({
            id, name, description, icon, columns,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }));
    },

    /**
     * Создаёт новую таблицу с указанными колонками.
     * ID генерируется локально; mock-tables автоматически создаёт датасит при первом GET.
     * Схема колонок сохраняется в localStorage для персистентности между сессиями.
     */
    async createTable(
        name: string,
        icon: string,
        columns: MwsColumn[],
        description = "",
    ): Promise<Omit<MwsTable, "rows">> {
        const id = `tbl_${Array.from(crypto.getRandomValues(new Uint8Array(8)))
            .map(b => b.toString(16).padStart(2, "0")).join("")}`;
        const meta: TableMeta = { id, name, description, icon, columns };
        customTables.push(meta);
        saveCustomTables(customTables);
        return {
            id, name, description, icon, columns,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    },

    /** Сохранение строк таблицы через PATCH API */
    async saveTable(table: MwsTable): Promise<MwsTable> {
        const saved = { ...table, updatedAt: new Date().toISOString() };
        // Конвертируем cells → Fusion records format
        const records: FusionRecord[] = saved.rows.map(row => ({
            recordId: row.id,
            fields:   row.cells as Record<string, unknown>,
        }));
        try {
            await patchRecords(table.id, records);
        } catch (e) {
            console.warn(`[tablesClient] saveTable API error for ${table.id}:`, e);
        }
        cacheSet(saved);
        return saved;
    },

    /** Принудительная инвалидация кэша одной таблицы */
    invalidateCache(id: string): void {
        tableCache.delete(id);
    },

    /** Статистика кэша для dev-инструментов */
    cacheStats(): { size: number; keys: string[] } {
        return { size: tableCache.size, keys: [...tableCache.keys()] };
    },
} as const;
