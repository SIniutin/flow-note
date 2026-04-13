// ─── src/editor/mwsTable/backlinksStore.ts ────────────────────────────────────
// Хранилище обратных ссылок: «какие документы используют каждую таблицу».
//
// Формат записи:
//   { id, docId, docTitle, tableId, insertedAt }
//
// При вставке / удалении mwsTable-узла MwsTableExtension.ts вызывает
// syncDocBacklinks — она сверяет текущий список tableId в документе
// с хранилищем и добавляет/удаляет записи.
//
// Паттерн pub-sub — как slashStore.ts и mentionStore.ts в проекте.

import { useEffect, useState } from "react";

// ── типы ─────────────────────────────────────────────────────────────────────

export interface Backlink {
    id: string;          // `${docId}::${tableId}`  — уникальность per-pair
    docId: string;
    docTitle: string;
    tableId: string;
    insertedAt: string;  // ISO
}

// ── localStorage ──────────────────────────────────────────────────────────────

const LS_KEY = "editor:backlinks:v1";

function load(): Backlink[] {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? (JSON.parse(raw) as Backlink[]) : [];
    } catch { return []; }
}

function persist(list: Backlink[]): void {
    try { localStorage.setItem(LS_KEY, JSON.stringify(list)); }
    catch (e) { console.warn("backlinksStore: persist failed", e); }
}

// ── in-memory state ───────────────────────────────────────────────────────────

let backlinks: Backlink[] = load();
const listeners = new Set<() => void>();

function notify() { listeners.forEach(l => l()); }

// ── public API ────────────────────────────────────────────────────────────────

export const backlinksStore = {
    /** Все backlinks */
    getAll(): Backlink[] { return backlinks; },

    /** Backlinks для конкретной таблицы */
    forTable(tableId: string): Backlink[] {
        return backlinks.filter(b => b.tableId === tableId);
    },

    /**
     * Синхронизирует backlinks документа с текущим набором tableId в нём.
     * Вызывается из ProseMirror-плагина при каждом изменении документа.
     * Идемпотентна — не генерирует лишних записей при ре-рендерах.
     */
    syncDoc(docId: string, docTitle: string, currentTableIds: string[]): void {
        const current = new Set(currentTableIds);

        // Убираем backlinks этого документа, которых больше нет в доке
        const kept = backlinks.filter(
            b => b.docId !== docId || current.has(b.tableId),
        );

        // Добавляем новые (которых ещё нет в хранилище)
        const existing = new Set(
            kept.filter(b => b.docId === docId).map(b => b.tableId),
        );
        const added: Backlink[] = [...current]
            .filter(tid => !existing.has(tid))
            .map(tid => ({
                id: `${docId}::${tid}`,
                docId,
                docTitle,
                tableId: tid,
                insertedAt: new Date().toISOString(),
            }));

        if (kept.length === backlinks.length && added.length === 0) return; // ничего не изменилось

        backlinks = [...kept, ...added];
        persist(backlinks);
        notify();
    },

    /** Полная очистка всех backlinks (dev / reset) */
    clear(): void {
        backlinks = [];
        persist(backlinks);
        notify();
    },

    subscribe(l: () => void): () => void {
        listeners.add(l);
        return () => { listeners.delete(l); };
    },
};

// ── React-хук ─────────────────────────────────────────────────────────────────

/** Возвращает backlinks для конкретной таблицы и реагирует на изменения. */
export function useBacklinksForTable(tableId: string): Backlink[] {
    const [list, setList] = useState<Backlink[]>(() =>
        backlinksStore.forTable(tableId),
    );
    useEffect(() => {
        // Пересчитываем при любом изменении хранилища
        const unsub = backlinksStore.subscribe(() =>
            setList(backlinksStore.forTable(tableId)),
        );
        return unsub;
    }, [tableId]);
    return list;
}

/** Возвращает Map<tableId, count> — для пикера */
export function useBacklinkCounts(): Map<string, number> {
    const [map, setMap] = useState<Map<string, number>>(() => buildCounts());
    useEffect(() => {
        const unsub = backlinksStore.subscribe(() => setMap(buildCounts()));
        return unsub;
    }, []);
    return map;
}

function buildCounts(): Map<string, number> {
    const m = new Map<string, number>();
    backlinksStore.getAll().forEach(b => {
        m.set(b.tableId, (m.get(b.tableId) ?? 0) + 1);
    });
    return m;
}
