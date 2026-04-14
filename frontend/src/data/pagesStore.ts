// ─── src/data/pagesStore.ts ────────────────────────────────────────────────────
// Список страниц хранится в Y.Map внутри shared workspace-документа.
// Все клиенты видят одни и те же страницы через Hocuspocus-синхронизацию.
//
// Текущая выбранная страница (_currentId) остаётся в localStorage —
// это per-browser состояние, общей синхронизации не требует.

import { useEffect, useState } from "react";
import { workspaceDoc } from "../editor/collab/collabProvider";

export interface WikiPage {
    id:        string;
    title:     string;
    icon?:     string;
    createdAt: string;
    updatedAt: string;
}

// ── Yjs map ────────────────────────────────────────────────────────────────────
// Ключ: page.id, значение: JSON-строка WikiPage
const yPages = workspaceDoc.getMap<string>("pages");

// ── localStorage keys ─────────────────────────────────────────────────────────
const LS_PAGES_CACHE = "wiki:pages:v1";          // кэш для offline-fallback
const LS_CURRENT     = "wiki:current-page:v1";

// ── helpers ───────────────────────────────────────────────────────────────────

function uuid(): string {
    return "page_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function buildFromYMap(): WikiPage[] {
    const result: WikiPage[] = [];
    yPages.forEach((json) => {
        try { result.push(JSON.parse(json) as WikiPage); } catch { /* skip invalid */ }
    });
    return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function loadLocalCache(): WikiPage[] {
    try {
        const raw = localStorage.getItem(LS_PAGES_CACHE);
        if (raw) return JSON.parse(raw) as WikiPage[];
    } catch { /* ignore */ }
    return [{
        id:        "page-default",
        title:     "Главная",
        icon:      "🏠",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }];
}

function saveLocalCache(pages: WikiPage[]): void {
    try { localStorage.setItem(LS_PAGES_CACHE, JSON.stringify(pages)); } catch { /* ignore */ }
}

// ── State ─────────────────────────────────────────────────────────────────────

// До первой синхронизации показываем кэшированные страницы (хороший UX).
let _pages: WikiPage[] = buildFromYMap().length > 0 ? buildFromYMap() : loadLocalCache();
let _currentId: string = localStorage.getItem(LS_CURRENT) ?? _pages[0]?.id ?? "page-default";

const listeners = new Set<() => void>();
function notify() { listeners.forEach(l => l()); }

function ensureCurrentIdValid(): void {
    if (!_pages.find(p => p.id === _currentId)) {
        _currentId = _pages[0]?.id ?? "page-default";
        try { localStorage.setItem(LS_CURRENT, _currentId); } catch { /* ignore */ }
    }
}

// ── Observe Y.Map changes (local + remote) ────────────────────────────────────

yPages.observe(() => {
    const fresh = buildFromYMap();
    if (fresh.length > 0) {
        _pages = fresh;
        saveLocalCache(_pages);
        ensureCurrentIdValid();
        notify();
    }
});

// ── Public API ────────────────────────────────────────────────────────────────

export const pagesStore = {
    getAll():    WikiPage[]       { return _pages; },
    getCurrent(): WikiPage | null { return _pages.find(p => p.id === _currentId) ?? _pages[0] ?? null; },
    getCurrentId(): string        { return _currentId; },
    get(id: string): WikiPage | null { return _pages.find(p => p.id === id) ?? null; },

    create(title: string, icon = "📄"): WikiPage {
        const page: WikiPage = {
            id:        uuid(),
            title:     title.trim() || "Без названия",
            icon,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        yPages.set(page.id, JSON.stringify(page));
        return page;
    },

    updateTitle(id: string, title: string): void {
        const json = yPages.get(id);
        if (!json) return;
        const page = JSON.parse(json) as WikiPage;
        yPages.set(id, JSON.stringify({
            ...page,
            title:     title.trim() || "Без названия",
            updatedAt: new Date().toISOString(),
        }));
    },

    delete(id: string): void {
        const next = _pages.find(p => p.id !== id);
        yPages.delete(id);
        if (_currentId === id) {
            pagesStore.setCurrentId(next?.id ?? "page-default");
        }
    },

    setCurrentId(id: string): void {
        if (_currentId === id) return;
        _currentId = id;
        try { localStorage.setItem(LS_CURRENT, id); } catch { /* ignore */ }
        notify();
    },

    subscribe(l: () => void): () => void {
        listeners.add(l);
        return () => { listeners.delete(l); };
    },

    /**
     * Вызывается после первой синхронизации workspace-документа.
     * Если workspace пуст — мигрируем страницы из localStorage.
     */
    onWorkspaceSynced(): void {
        if (yPages.size === 0) {
            const local = loadLocalCache();
            workspaceDoc.transact(() => {
                local.forEach(p => yPages.set(p.id, JSON.stringify(p)));
            });
            console.log("[pagesStore] migrated", local.length, "pages from localStorage to workspace");
        }
    },
};

// ── React hooks ───────────────────────────────────────────────────────────────

export function usePages(): WikiPage[] {
    const [pages, setPages] = useState<WikiPage[]>(() => pagesStore.getAll());
    useEffect(() => pagesStore.subscribe(() => setPages(pagesStore.getAll())), []);
    return pages;
}

export function useCurrentPage(): WikiPage | null {
    const [page, setPage] = useState<WikiPage | null>(() => pagesStore.getCurrent());
    useEffect(() => pagesStore.subscribe(() => setPage(pagesStore.getCurrent())), []);
    return page;
}
