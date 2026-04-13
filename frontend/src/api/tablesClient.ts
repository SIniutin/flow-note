// ─── src/api/tablesClient.ts ──────────────────────────────────────────────────
// Мок-клиент MWS Tables. Ключ localStorage согласован с остальными ключами
// проекта (editor:*:v1). API намеренно асинхронный — замена на реальный
// бэкенд сведётся к смене реализации без изменения вызывающего кода.

import type { MwsTable } from "../types/mwsTable";

// ── seed data ─────────────────────────────────────────────────────────────────

const SEED: MwsTable[] = [
    {
        id: "tbl_roadmap",
        name: "Product Roadmap",
        description: "Бэклог Q2–Q3 и статусы поставки",
        icon: "🗺️",
        columns: [
            { id: "col_title",  name: "Название",   type: "text",    width: 240 },
            { id: "col_status", name: "Статус",      type: "select",  width: 120 },
            { id: "col_owner",  name: "Ответственный", type: "text",  width: 140 },
            { id: "col_eta",    name: "ETA",          type: "date",   width: 120 },
            { id: "col_done",   name: "Готово",       type: "boolean", width: 80 },
        ],
        rows: [
            { id: "r1", cells: { col_title: "Тёмная тема",     col_status: "In Progress", col_owner: "Алиса",  col_eta: "2025-06-15", col_done: false } },
            { id: "r2", cells: { col_title: "Экспорт PDF",      col_status: "Planned",    col_owner: "Боб",    col_eta: "2025-07-01", col_done: false } },
            { id: "r3", cells: { col_title: "Офлайн-режим",     col_status: "Done",       col_owner: "Карол",  col_eta: "2025-05-20", col_done: true  } },
            { id: "r4", cells: { col_title: "Realtime collab",  col_status: "Planned",    col_owner: "Дэн",    col_eta: "2025-08-01", col_done: false } },
        ],
        createdAt: "2025-01-10T09:00:00Z",
        updatedAt: "2025-05-01T14:22:00Z",
    },
    {
        id: "tbl_team",
        name: "Team Directory",
        description: "Контакты и роли инженерного отдела",
        icon: "👥",
        columns: [
            { id: "col_name",  name: "Имя",   type: "text",  width: 180 },
            { id: "col_role",  name: "Роль",  type: "text",  width: 180 },
            { id: "col_team",  name: "Команда", type: "select", width: 140 },
            { id: "col_email", name: "Email", type: "url",   width: 220 },
        ],
        rows: [
            { id: "r1", cells: { col_name: "Алиса Ковальски",   col_role: "Senior Frontend", col_team: "Platform", col_email: "alice@example.com" } },
            { id: "r2", cells: { col_name: "Боб Мюллер",        col_role: "Backend Lead",    col_team: "Core",     col_email: "bob@example.com"   } },
            { id: "r3", cells: { col_name: "Карол Танака",       col_role: "Product Manager", col_team: "Platform", col_email: "carol@example.com" } },
            { id: "r4", cells: { col_name: "Дэн Оби",            col_role: "Designer",        col_team: "Design",   col_email: "dan@example.com"   } },
        ],
        createdAt: "2025-02-01T10:00:00Z",
        updatedAt: "2025-04-28T11:00:00Z",
    },
    {
        id: "tbl_bugs",
        name: "Bug Tracker",
        description: "Открытые баги текущего спринта",
        icon: "🐛",
        columns: [
            { id: "col_id",       name: "#",         type: "number", width: 60  },
            { id: "col_title",    name: "Название",  type: "text",   width: 260 },
            { id: "col_sev",      name: "Severity",  type: "select", width: 110 },
            { id: "col_assignee", name: "Assignee",  type: "text",   width: 140 },
            { id: "col_url",      name: "Issue URL", type: "url",    width: 200 },
        ],
        rows: [
            { id: "r1", cells: { col_id: 1042, col_title: "Краш при вставке из Google Docs", col_sev: "Critical", col_assignee: "Алиса", col_url: "https://github.com/org/repo/issues/1042" } },
            { id: "r2", cells: { col_id: 1051, col_title: "z-index конфликт Mention dropdown", col_sev: "Medium", col_assignee: "Боб",  col_url: "https://github.com/org/repo/issues/1051" } },
            { id: "r3", cells: { col_id: 1060, col_title: "Slash-меню не закрывается на Escape в Safari", col_sev: "Low", col_assignee: "Карол", col_url: "https://github.com/org/repo/issues/1060" } },
        ],
        createdAt: "2025-03-15T08:00:00Z",
        updatedAt: "2025-05-03T16:45:00Z",
    },
    {
        id: "tbl_okrs",
        name: "OKRs Q2 2025",
        description: "Цели и ключевые результаты квартала",
        icon: "🎯",
        columns: [
            { id: "col_obj",   name: "Цель",            type: "text",   width: 260 },
            { id: "col_kr",    name: "Ключевой результат", type: "text", width: 260 },
            { id: "col_prog",  name: "Прогресс %",       type: "number", width: 110 },
            { id: "col_owner", name: "Ответственный",    type: "text",   width: 130 },
        ],
        rows: [
            { id: "r1", cells: { col_obj: "Выпустить wiki-редактор v1", col_kr: "TipTap-интеграция готова",       col_prog: 80, col_owner: "Алиса" } },
            { id: "r2", cells: { col_obj: "Выпустить wiki-редактор v1", col_kr: "Realtime collab в staging",      col_prog: 30, col_owner: "Боб"   } },
            { id: "r3", cells: { col_obj: "Улучшить онбординг",         col_kr: "Time-to-first-doc < 2 мин",     col_prog: 55, col_owner: "Карол" } },
        ],
        createdAt: "2025-04-01T07:00:00Z",
        updatedAt: "2025-05-02T09:30:00Z",
    },
];

// ── store ─────────────────────────────────────────────────────────────────────

const LS_KEY = "editor:mws-tables:v1";

function loadStore(): Map<string, MwsTable> {
    const map = new Map<string, MwsTable>();
    try {
        const raw = localStorage.getItem(LS_KEY);
        const list: MwsTable[] = raw ? JSON.parse(raw) : SEED;
        list.forEach(t => map.set(t.id, t));
    } catch {
        SEED.forEach(t => map.set(t.id, t));
    }
    return map;
}

function persist(store: Map<string, MwsTable>): void {
    try { localStorage.setItem(LS_KEY, JSON.stringify([...store.values()])); }
    catch (e) { console.warn("mws-tables: failed to persist", e); }
}

let store = loadStore();
const delay = (ms = 100) => new Promise<void>(r => setTimeout(r, ms));

// ── TTL cache ─────────────────────────────────────────────────────────────────
// NodeView грузит таблицу при каждом монтировании. Без кэша каждый
// ре-рендер бьёт в localStorage + JSON.parse. Кэш держит данные 30с.
// saveTable и resetToSeed инвалидируют соответствующие записи.

const CACHE_TTL = 30_000; // мс

interface CacheEntry { table: MwsTable; expiresAt: number; }
const tableCache = new Map<string, CacheEntry>();

function cacheGet(id: string): MwsTable | null {
    const entry = tableCache.get(id);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { tableCache.delete(id); return null; }
    return entry.table;
}

function cacheSet(table: MwsTable): void {
    tableCache.set(table.id, { table, expiresAt: Date.now() + CACHE_TTL });
}

function cacheInvalidate(id: string): void {
    tableCache.delete(id);
}

// ── public API ────────────────────────────────────────────────────────────────

export const tablesClient = {
    /** Список всех таблиц без строк (для пикера) */
    async listTables(): Promise<Omit<MwsTable, "rows">[]> {
        await delay();
        return [...store.values()].map(({ rows: _, ...rest }) => rest);
    },

    /** Одна таблица со строками — сначала кэш, потом store */
    async getTable(id: string): Promise<MwsTable | null> {
        const cached = cacheGet(id);
        if (cached) return cached;           // кэш-хит: без задержки
        await delay();
        const table = store.get(id) ?? null;
        if (table) cacheSet(table);
        return table;
    },

    /** Поиск по имени / описанию */
    async searchTables(query: string): Promise<Omit<MwsTable, "rows">[]> {
        await delay(50);
        const q = query.toLowerCase();
        return [...store.values()]
            .filter(t =>
                t.name.toLowerCase().includes(q) ||
                (t.description ?? "").toLowerCase().includes(q),
            )
            .map(({ rows: _, ...rest }) => rest);
    },

    /** Сохранение таблицы — обновляет store, кэш и localStorage */
    async saveTable(table: MwsTable): Promise<MwsTable> {
        await delay();
        const saved = { ...table, updatedAt: new Date().toISOString() };
        store.set(saved.id, saved);
        cacheSet(saved);                     // сразу обновляем кэш
        persist(store);
        return saved;
    },

    /** Принудительная инвалидация кэша одной таблицы (для тестов/dev) */
    invalidateCache(id: string): void {
        cacheInvalidate(id);
    },

    /** Сброс к seed-данным (dev / тесты) */
    resetToSeed(): void {
        store = new Map(SEED.map(t => [t.id, t]));
        tableCache.clear();
        persist(store);
    },

    /** Статистика кэша для dev-инструментов */
    cacheStats(): { size: number; keys: string[] } {
        return { size: tableCache.size, keys: [...tableCache.keys()] };
    },
} as const;
