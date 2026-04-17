// ─── src/editor/collab/collabProvider.ts ─────────────────────────────────────
// Синглтон: один Y.Doc и один HocuspocusProvider.
// HocuspocusProvider — WebSocket-based Yjs sync через collab-service.
// При смене страницы вызвать connectCollab(pageId) и перемонтировать редактор
// через key={pageId} чтобы TipTap подхватил новый ydoc.
//
// ES-модули используют live bindings: изменение export let ydoc / awareness
// в connectCollab() сразу видно всем импортёрам при следующем обращении.

import { useEffect, useState } from "react"; // useEffect+useState нужны для usePageMeta ниже
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { getAccessToken } from "../../data/authStore";

// ── WebSocket base URL ─────────────────────────────────────────────────────────
const WS_BASE = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/collab`;



// ── Singleton state ───────────────────────────────────────────────────────────

export let ydoc: Y.Doc = new Y.Doc();
export let provider: HocuspocusProvider | null = null;
export let awareness: HocuspocusProvider["awareness"] | null = null;
export let providerEpoch = 0;

// ── External store subscription (for useSyncExternalStore in useCollabStatus) ──
// Listeners are notified on awareness changes and provider switches.
// We manage subscription directly so we can detach BEFORE provider.destroy()
// to avoid "setState during render" when connectCollab() runs in App's render body.

const _statusListeners = new Set<() => void>();

export function subscribeCollabStatus(listener: () => void): () => void {
    _statusListeners.add(listener);
    return () => _statusListeners.delete(listener);
}

function _notifyStatusListeners(): void {
    _statusListeners.forEach(l => l());
}

function _detachAwareness(): void {
    if (provider?.awareness) {
        provider.awareness.off("change", _notifyStatusListeners);
    }
}

function makeProvider(pageId: string, doc: Y.Doc): HocuspocusProvider {
    const p = new HocuspocusProvider({
        url: WS_BASE,
        name: pageId,
        document: doc,
        token: getAccessToken() ?? "",
        onConnect:    () => console.log(`[collab] connected  page=${pageId}`),
        onDisconnect: () => console.log(`[collab] disconnected  page=${pageId}`),
        onAuthenticated: () => console.log(`[collab] authenticated  page=${pageId}`),
        onAuthenticationFailed: ({ reason }: { reason: string }) =>
            console.warn(`[collab] auth failed page=${pageId}:`, reason),
        onClose: ({ event }: { event: CloseEvent }) =>
            console.warn(`[collab] ws closed  page=${pageId}  code=${event.code}`),
        // Сообщаем редактору, что сервер прислал свой стейт и можно проверять
        // пустоту документа. Важно для предотвращения дублирования контента:
        // не вставляем начальный контент пока не убедились что сервер реально пуст.
        onSynced: () => {
            window.dispatchEvent(new CustomEvent("collab:synced"));
        },
    });
    p.awareness.on("change", _notifyStatusListeners);
    return p;
}

function hasAccessToken(): boolean {
    return Boolean(getAccessToken());
}

function setProvider(next: HocuspocusProvider | null): void {
    provider = next;
    awareness = next?.awareness ?? null;
    providerEpoch += 1;
    _notifyStatusListeners();
}

// ── Page switch ───────────────────────────────────────────────────────────────

/**
 * Переподключиться к другому документу.
 * После вызова — обязательно перемонтировать редактор (key={pageId}),
 * иначе TipTap продолжит работать со старым ydoc.
 */
export function connectCollab(pageId: string): void {
    _detachAwareness(); // must happen BEFORE destroy to avoid setState-during-render
    provider?.destroy();
    ydoc.destroy();

    ydoc = new Y.Doc();
    if (!hasAccessToken()) {
        setProvider(null);
        return;
    }
    setProvider(makeProvider(pageId, ydoc));
}

/**
 * Пересоздаёт только WebSocket-провайдер, не трогая ydoc.
 * Используется после обновления JWT-токена — редактор ремонтировать не нужно.
 */
export function reconnectPageProvider(pageId: string): void {
    _detachAwareness();
    provider?.destroy();
    if (!hasAccessToken()) {
        setProvider(null);
        return;
    }
    setProvider(makeProvider(pageId, ydoc));
}

/**
 * Полностью рвёт WebSocket-соединение и освобождает ydoc.
 * Вызывать при logout — чтобы убрать присутствие пользователя у других участников.
 */
export function disconnectCollab(): void {
    _detachAwareness();
    provider?.destroy();
    ydoc.destroy();
    ydoc = new Y.Doc();
    setProvider(null);
}

export const ROOM_NAME = "wiki-editor-v1"; // kept for backward compat

// ── Page meta (title / description) via Y.Map ─────────────────────────────────
// Ключ "meta" в ydoc хранит название и описание страницы.
// Collab-service синхронизирует изменения между клиентами;
// при добавлении наблюдателя на сервере он сможет вызвать UpdatePage gRPC.

export interface PageMeta {
    title:       string | null;
    description: string | null;
}

/** Записать поле в meta-map текущего ydoc. */
export function setPageMeta(key: "title" | "description", value: string): void {
    (ydoc.getMap("meta") as Y.Map<string>).set(key, value || "");
}

/**
 * React-хук: подписывается на Y.Map("meta") текущего ydoc.
 * Перезапускается при смене pageId (ydoc уже заменён через connectCollab).
 *
 * Хранит pageId вместе с данными, чтобы при навигации не отдавать устаревший
 * заголовок предыдущей страницы — иначе App.tsx успевал бы вызвать
 * pagesStore.updateTitle(newPageId, oldTitle) до того, как ydoc синхронизируется.
 */
export function usePageMeta(pageId: string): PageMeta {
    const [stateData, setStateData] = useState<{ pageId: string; meta: PageMeta }>(() => ({
        pageId,
        meta: { title: null, description: null },
    }));

    useEffect(() => {
        // При смене страницы connectCollab уже заменил ydoc — читаем свежую карту.
        const readMeta = () => {
            const m = ydoc.getMap("meta") as Y.Map<string>;
            setStateData({
                pageId,
                meta: {
                    title:       m.get("title")       ?? null,
                    description: m.get("description") ?? null,
                },
            });
        };
        readMeta();
        // Подписываемся на любые изменения документа через Y.Doc.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = ydoc as any;
        doc.on("update", readMeta);
        return () => doc.off("update", readMeta);
    }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Если данные принадлежат другому pageId (навигация только что произошла,
    // эффект ещё не обновил состояние) — возвращаем null, чтобы не «заразить»
    // другую страницу устаревшим заголовком.
    return stateData.pageId === pageId ? stateData.meta : { title: null, description: null };
}
