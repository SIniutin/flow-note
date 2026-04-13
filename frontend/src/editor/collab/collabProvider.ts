// ─── src/editor/collab/collabProvider.ts ─────────────────────────────────────
// Синглтон: один Y.Doc и один WebrtcProvider на всё приложение.
//
// WebrtcProvider с signaling: [] работает ТОЛЬКО через BroadcastChannel —
// т.е. синхронизация между вкладками одного браузера без внешнего сервера.
// Для межсетевого колллаба нужно добавить адрес signaling-сервера.

import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";

export const ROOM_NAME = "wiki-editor-v1";

/** Общий Y.Doc — один на всё приложение */
export const ydoc = new Y.Doc();

/**
 * WebRTC провайдер.
 * signaling: [] — отключаем внешние серверы, используем только
 * BroadcastChannel (синхронизация между вкладками того же браузера).
 */
export const provider = new WebrtcProvider(ROOM_NAME, ydoc, {
    signaling: [],      // BroadcastChannel only — no external servers needed
    maxConns: 20,
    filterBcConns: false,
});

/** Awareness: хранит состояние присутствия всех пользователей */
export const awareness = provider.awareness;
