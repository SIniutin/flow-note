// ─── src/data/pagelinksStore.ts ────────────────────────────────────────────────
// Хранилище page-to-page ссылок: «какие страницы ссылаются на данную».
// Аналог backlinksStore, но для pageLink-узлов (а не mwsTable).
//
// syncPage(fromId, fromTitle, linkedPageIds) вызывается из ProseMirror-плагина
// при каждом изменении документа.

import { useEffect, useState } from "react";

export interface PageBacklink {
    id:        string;    // `${fromId}::${toId}`
    fromId:    string;
    fromTitle: string;
    toId:      string;
    createdAt: string;
}

const LS_KEY = "wiki:pagelinks:v1";

function load(): PageBacklink[] {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? (JSON.parse(raw) as PageBacklink[]) : [];
    } catch { return []; }
}

function persist(list: PageBacklink[]): void {
    try { localStorage.setItem(LS_KEY, JSON.stringify(list)); }
    catch (e) { console.warn("[pagelinksStore] persist failed", e); }
}

let links: PageBacklink[] = load();
const listeners = new Set<() => void>();
function notify() { listeners.forEach(l => l()); }

export const pagelinksStore = {
    getAll(): PageBacklink[] { return links; },

    /** Входящие ссылки для данной страницы */
    incoming(toId: string): PageBacklink[] {
        return links.filter(l => l.toId === toId);
    },

    /** Исходящие ссылки со страницы */
    outgoing(fromId: string): PageBacklink[] {
        return links.filter(l => l.fromId === fromId);
    },

    /**
     * Синхронизирует ссылки документа fromId.
     * Вызывается при каждом изменении документа — идемпотентна.
     */
    syncPage(fromId: string, fromTitle: string, linkedPageIds: string[]): void {
        const current = new Set(linkedPageIds);
        // Удаляем устаревшие ссылки этого документа
        const kept = links.filter(l => l.fromId !== fromId || current.has(l.toId));
        // Добавляем новые
        const existing = new Set(kept.filter(l => l.fromId === fromId).map(l => l.toId));
        const added: PageBacklink[] = [...current]
            .filter(toId => !existing.has(toId))
            .map(toId => ({
                id:        `${fromId}::${toId}`,
                fromId,
                fromTitle,
                toId,
                createdAt: new Date().toISOString(),
            }));

        if (kept.length === links.length && added.length === 0) return;
        links = [...kept, ...added];
        persist(links);
        notify();
    },

    subscribe(l: () => void): () => void {
        listeners.add(l);
        return () => listeners.delete(l);
    },
};

// ── React hooks ───────────────────────────────────────────────────────────────

export function useIncomingLinks(pageId: string): PageBacklink[] {
    const [list, setList] = useState<PageBacklink[]>(() => pagelinksStore.incoming(pageId));
    useEffect(() => {
        setList(pagelinksStore.incoming(pageId));
        return pagelinksStore.subscribe(() => setList(pagelinksStore.incoming(pageId)));
    }, [pageId]);
    return list;
}

export function useOutgoingLinks(pageId: string): PageBacklink[] {
    const [list, setList] = useState<PageBacklink[]>(() => pagelinksStore.outgoing(pageId));
    useEffect(() => {
        setList(pagelinksStore.outgoing(pageId));
        return pagelinksStore.subscribe(() => setList(pagelinksStore.outgoing(pageId)));
    }, [pageId]);
    return list;
}
