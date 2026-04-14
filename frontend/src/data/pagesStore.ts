// ─── src/data/pagesStore.ts ────────────────────────────────────────────────────
// CRUD-хранилище вики-страниц. Каждая страница — документ Yjs в collab-service.
// ID страницы используется как documentName в HocuspocusProvider.

import { useEffect, useState } from "react";

export interface WikiPage {
    id:        string;   // UUID — documentName в collab-service
    title:     string;
    icon?:     string;   // эмодзи
    createdAt: string;   // ISO
    updatedAt: string;
}

const LS_PAGES   = "wiki:pages:v1";
const LS_CURRENT = "wiki:current-page:v1";

// ── helpers ───────────────────────────────────────────────────────────────────

function uuid(): string {
    return "page_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

// ── state ─────────────────────────────────────────────────────────────────────

function loadPages(): WikiPage[] {
    try {
        const raw = localStorage.getItem(LS_PAGES);
        if (raw) return JSON.parse(raw) as WikiPage[];
    } catch { /* ignore */ }
    // Seed: одна стартовая страница
    const seed: WikiPage = {
        id:        "page-default",
        title:     "Главная",
        icon:      "🏠",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    return [seed];
}

function savePages(pages: WikiPage[]): void {
    try { localStorage.setItem(LS_PAGES, JSON.stringify(pages)); }
    catch (e) { console.warn("[pagesStore] save failed:", e); }
}

let _pages: WikiPage[] = loadPages();
let _currentId: string = localStorage.getItem(LS_CURRENT) ?? _pages[0]?.id ?? "page-default";

const listeners = new Set<() => void>();
function notify() { listeners.forEach(l => l()); }

// ── public API ─────────────────────────────────────────────────────────────────

export const pagesStore = {
    getAll(): WikiPage[] { return _pages; },

    getCurrent(): WikiPage | null {
        return _pages.find(p => p.id === _currentId) ?? _pages[0] ?? null;
    },

    getCurrentId(): string { return _currentId; },

    get(id: string): WikiPage | null {
        return _pages.find(p => p.id === id) ?? null;
    },

    create(title: string, icon = "📄"): WikiPage {
        const page: WikiPage = {
            id:        uuid(),
            title:     title.trim() || "Без названия",
            icon,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        _pages = [..._pages, page];
        savePages(_pages);
        notify();
        return page;
    },

    updateTitle(id: string, title: string): void {
        _pages = _pages.map(p =>
            p.id === id ? { ...p, title: title.trim() || "Без названия", updatedAt: new Date().toISOString() } : p,
        );
        savePages(_pages);
        notify();
    },

    delete(id: string): void {
        _pages = _pages.filter(p => p.id !== id);
        // Если удалили текущую — переключаемся на первую
        if (_currentId === id) {
            _currentId = _pages[0]?.id ?? "page-default";
            try { localStorage.setItem(LS_CURRENT, _currentId); } catch { /* ignore */ }
        }
        savePages(_pages);
        notify();
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
