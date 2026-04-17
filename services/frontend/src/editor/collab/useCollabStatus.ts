// ─── src/editor/collab/useCollabStatus.ts ─────────────────────────────────────
// Хук: статус подключения и список активных пользователей из awareness.
// Использует useSyncExternalStore. getSnapshot ОБЯЗАН возвращать кэшированный
// объект (===), иначе React уходит в бесконечный цикл ре-рендеров.

import { useSyncExternalStore } from "react";
import { awareness, subscribeCollabStatus } from "./collabProvider";

export interface CollabUser {
    clientId: number;
    name:     string;
    color:    string;
}

export interface CollabStatus {
    peers: CollabUser[];
    totalClients: number;
}

const EMPTY_STATUS: CollabStatus = { peers: [], totalClients: 0 };

// Кэш последнего снапшота — возвращаем тот же объект пока данные не изменились.
let _cachedStatus: CollabStatus = EMPTY_STATUS;

function computeStatus(): CollabStatus {
    const aw = awareness;
    if (!aw) return EMPTY_STATUS;

    const states = aw.getStates();
    const myId   = aw.clientID;

    const peers: CollabUser[] = [];
    states.forEach((state, clientId) => {
        if (clientId === myId) return;
        const user = state.user as { name?: string; color?: string } | undefined;
        if (user?.name) {
            peers.push({ clientId, name: user.name, color: user.color ?? "#8b7cff" });
        }
    });

    // Сравниваем с кэшем по значению, чтобы не создавать новый объект зря.
    const total = states.size;
    if (
        _cachedStatus !== EMPTY_STATUS &&
        _cachedStatus.totalClients === total &&
        _cachedStatus.peers.length === peers.length &&
        _cachedStatus.peers.every((p, i) =>
            p.clientId === peers[i].clientId &&
            p.name     === peers[i].name     &&
            p.color    === peers[i].color
        )
    ) {
        return _cachedStatus; // ← возвращаем тот же объект, React не ре-рендерит
    }

    _cachedStatus = { peers, totalClients: total };
    return _cachedStatus;
}

export function useCollabStatus(): CollabStatus {
    return useSyncExternalStore(subscribeCollabStatus, computeStatus, () => EMPTY_STATUS);
}
