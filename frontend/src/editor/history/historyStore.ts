// ─── src/editor/history/historyStore.ts ──────────────────────────────────────
// Снапшоты Yjs документа для версионирования.
// Хранит до MAX_SNAPSHOTS снапшотов на страницу в localStorage.
// Снапшот создаётся автоматически каждые SNAPSHOT_INTERVAL_MS при изменениях
// и вручную через createSnapshot().

import * as Y from "yjs";
// Yjs 13 экспортирует эти функции в runtime, но TypeScript typings отстают.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yjsAny = Y as any;
const encodeStateAsUpdate: (doc: Y.Doc, sv?: Uint8Array) => Uint8Array = yjsAny.encodeStateAsUpdate;
const applyUpdate: (doc: Y.Doc, update: Uint8Array) => void = yjsAny.applyUpdate;
const encodeStateVector: (doc: Y.Doc) => Uint8Array = yjsAny.encodeStateVector;
import { useEffect, useState } from "react";

const MAX_SNAPSHOTS    = 20;
const SNAPSHOT_INTERVAL_MS = 5 * 60_000; // каждые 5 мин

export interface SnapshotEntry {
    id:          string;   // uuid
    pageId:      string;
    label:       string;   // "Автосохранение 14:35" / "Версия перед удалением"
    createdAt:   string;   // ISO
    /** base64-encoded Y.encodeStateAsUpdate() */
    stateB64:    string;
    /** HTML-содержимое редактора в момент снапшота — используется при restore */
    contentHtml?: string;
}

const LS_KEY = (pageId: string) => `wiki:history:${pageId}:v1`;

function loadSnapshots(pageId: string): SnapshotEntry[] {
    try {
        const raw = localStorage.getItem(LS_KEY(pageId));
        return raw ? JSON.parse(raw) as SnapshotEntry[] : [];
    } catch { return []; }
}

function saveSnapshots(pageId: string, snaps: SnapshotEntry[]): void {
    try { localStorage.setItem(LS_KEY(pageId), JSON.stringify(snaps)); }
    catch (e) { console.warn("[historyStore] save failed:", e); }
}

function uint8ToBase64(bytes: Uint8Array): string {
    let str = "";
    bytes.forEach(b => { str += String.fromCharCode(b); });
    return btoa(str);
}

function base64ToUint8(b64: string): Uint8Array {
    const str = atob(b64);
    const arr = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
    return arr;
}

const listeners = new Map<string, Set<() => void>>();
function notifyPage(pageId: string) {
    listeners.get(pageId)?.forEach(l => l());
}

// ── public API ─────────────────────────────────────────────────────────────────

export const historyStore = {
    /** Создать снапшот вручную */
    createSnapshot(pageId: string, ydoc: Y.Doc, label?: string, html?: string): SnapshotEntry {
        const state = encodeStateAsUpdate(ydoc);
        const snap: SnapshotEntry = {
            id:          `snap_${Date.now().toString(36)}`,
            pageId,
            label:       label ?? `Автосохранение ${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`,
            createdAt:   new Date().toISOString(),
            stateB64:    uint8ToBase64(state),
            contentHtml: html,
        };
        const snaps = [snap, ...loadSnapshots(pageId)].slice(0, MAX_SNAPSHOTS);
        saveSnapshots(pageId, snaps);
        notifyPage(pageId);
        return snap;
    },

    /** Получить список снапшотов (новые первые) */
    list(pageId: string): SnapshotEntry[] {
        return loadSnapshots(pageId);
    },

    /**
     * Восстановить содержимое из снапшота.
     * Возвращает сохранённый HTML, который компонент должен передать в
     * editor.commands.setContent(html, true) — это энкодирует изменения
     * обратно в ydoc через Collaboration-extension (правильный CRDT-путь).
     */
    restore(pageId: string, snapId: string): string | null {
        const snap = loadSnapshots(pageId).find(s => s.id === snapId);
        if (!snap?.contentHtml) return null;
        return snap.contentHtml;
    },

    /** Удалить снапшот */
    delete(pageId: string, snapId: string): void {
        const snaps = loadSnapshots(pageId).filter(s => s.id !== snapId);
        saveSnapshots(pageId, snaps);
        notifyPage(pageId);
    },

    subscribe(pageId: string, l: () => void): () => void {
        if (!listeners.has(pageId)) listeners.set(pageId, new Set());
        listeners.get(pageId)!.add(l);
        return () => { listeners.get(pageId)?.delete(l); };
    },
};

// ── Auto-snapshot hook ────────────────────────────────────────────────────────

export function useAutoSnapshot(pageId: string, ydoc: Y.Doc): void {
    useEffect(() => {
        const interval = setInterval(() => {
            // Создаём снапшот только если документ не пустой
            const fragment = ydoc.getXmlFragment("default");
            if (fragment.length > 0) {
                historyStore.createSnapshot(pageId, ydoc);
            }
        }, SNAPSHOT_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [pageId, ydoc]);
}

// ── React hook ─────────────────────────────────────────────────────────────────

export function useHistory(pageId: string): SnapshotEntry[] {
    const [snaps, setSnaps] = useState<SnapshotEntry[]>(() => historyStore.list(pageId));
    useEffect(() => {
        setSnaps(historyStore.list(pageId));
        return historyStore.subscribe(pageId, () => setSnaps(historyStore.list(pageId)));
    }, [pageId]);
    return snaps;
}
