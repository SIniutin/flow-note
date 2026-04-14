// ─── src/data/pagesStore.ts ────────────────────────────────────────────────────
// Список страниц каждого пользователя хранится на бэкенде (page-service).
// Локально держим кэш в localStorage для мгновенного отображения при загрузке.

import { useEffect, useState } from "react";
import { pageClient } from "../api/pageClient";

export interface WikiPage {
    id:          string;
    title:       string;
    icon?:       string;
    description?: string;
    createdAt:   string;
    updatedAt:   string;
}

// ── localStorage keys ─────────────────────────────────────────────────────────
const LS_PAGES_CACHE = "wiki:pages:v2";
const LS_CURRENT     = "wiki:current-page:v2";

// ── helpers ───────────────────────────────────────────────────────────────────

function loadLocalCache(): WikiPage[] {
    try {
        const raw = localStorage.getItem(LS_PAGES_CACHE);
        if (raw) return JSON.parse(raw) as WikiPage[];
    } catch { /* ignore */ }
    return [];
}

function saveLocalCache(pages: WikiPage[]): void {
    try { localStorage.setItem(LS_PAGES_CACHE, JSON.stringify(pages)); } catch { /* ignore */ }
}

// ── State ─────────────────────────────────────────────────────────────────────

let _pages: WikiPage[]    = loadLocalCache();
let _currentId: string    = localStorage.getItem(LS_CURRENT) ?? _pages[0]?.id ?? "";

const listeners = new Set<() => void>();
function notify() { listeners.forEach(l => l()); }

function setPages(pages: WikiPage[]): void {
    _pages = pages;
    saveLocalCache(pages);
    if (!_pages.find(p => p.id === _currentId)) {
        _currentId = _pages[0]?.id ?? "";
        try { localStorage.setItem(LS_CURRENT, _currentId); } catch { /* ignore */ }
    }
    notify();
}

// ── Public API ────────────────────────────────────────────────────────────────

export const pagesStore = {
    getAll():     WikiPage[]       { return _pages; },
    getCurrent(): WikiPage | null  { return _pages.find(p => p.id === _currentId) ?? _pages[0] ?? null; },
    getCurrentId(): string         { return _currentId; },
    get(id: string): WikiPage | null { return _pages.find(p => p.id === id) ?? null; },

    /** Загружает страницы с бэкенда. Вызывается после аутентификации. */
    async loadFromBackend(): Promise<void> {
        try {
            const { pages } = await pageClient.listAllowed();
            const mapped: WikiPage[] = pages.map(bp => ({
                id:        bp.id,
                title:     bp.title,
                createdAt: bp.createdAt,
                updatedAt: bp.updatedAt,
            }));
            setPages(mapped);
        } catch (err) {
            console.warn("[pagesStore] loadFromBackend failed:", err);
        }
    },

    async create(title: string, icon = "📄"): Promise<WikiPage> {
        const { page: bp } = await pageClient.create(title.trim() || "Без названия");
        const page: WikiPage = {
            id:        bp.id,
            title:     bp.title,
            icon,
            createdAt: bp.createdAt,
            updatedAt: bp.updatedAt,
        };
        setPages([..._pages, page]);
        return page;
    },

    updateTitle(id: string, title: string): void {
        setPages(_pages.map(p =>
            p.id === id
                ? { ...p, title: title.trim() || "Без названия", updatedAt: new Date().toISOString() }
                : p
        ));
    },

    updateDescription(id: string, description: string): void {
        setPages(_pages.map(p =>
            p.id === id
                ? { ...p, description: description.trim() || undefined, updatedAt: new Date().toISOString() }
                : p
        ));
    },

    delete(id: string): void {
        const next = _pages.find(p => p.id !== id);
        setPages(_pages.filter(p => p.id !== id));
        if (_currentId === id) {
            pagesStore.setCurrentId(next?.id ?? "");
        }
        pageClient.delete(id).catch(err =>
            console.warn("[pagesStore] delete failed:", err)
        );
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
