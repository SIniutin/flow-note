// ─── src/editor/collab/collabProvider.ts ─────────────────────────────────────
// Синглтон: один Y.Doc и один HocuspocusProvider.
// HocuspocusProvider — WebSocket-based Yjs sync через collab-service.
// При смене страницы вызвать connectCollab(pageId) и перемонтировать редактор
// через key={pageId} чтобы TipTap подхватил новый ydoc.
//
// ES-модули используют live bindings: изменение export let ydoc / awareness
// в connectCollab() сразу видно всем импортёрам при следующем обращении.

import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { getAccessToken } from "../../data/authStore";

// ── WebSocket base URL ─────────────────────────────────────────────────────────
const WS_BASE = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/collab`;

// ── Singleton state ───────────────────────────────────────────────────────────

export let ydoc: Y.Doc = new Y.Doc();

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
    });
    return p;
}

export let provider: HocuspocusProvider = makeProvider("page-default", ydoc);
export let awareness = provider.awareness;

// ── Page switch ───────────────────────────────────────────────────────────────

/**
 * Переподключиться к другому документу.
 * После вызова — обязательно перемонтировать редактор (key={pageId}),
 * иначе TipTap продолжит работать со старым ydoc.
 */
export function connectCollab(pageId: string): void {
    provider.destroy();
    ydoc.destroy();

    ydoc     = new Y.Doc();
    provider = makeProvider(pageId, ydoc);
    awareness = provider.awareness;
}

export const ROOM_NAME = "wiki-editor-v1"; // kept for backward compat
