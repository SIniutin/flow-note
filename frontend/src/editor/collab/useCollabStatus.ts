// ─── src/editor/collab/useCollabStatus.ts ─────────────────────────────────────
// Хук: статус подключения и список активных пользователей из awareness.
// Импортируем provider как объект — при reconnect live binding обновится,
// поэтому в каждом эффекте читаем provider.awareness, а не кэшируем.

import { useEffect, useState } from "react";
import { awareness, providerEpoch } from "./collabProvider";

export interface CollabUser {
    clientId: number;
    name:     string;
    color:    string;
}

export interface CollabStatus {
    /** Другие пользователи в документе (без себя) */
    peers: CollabUser[];
    /** Общее число клиентов включая себя */
    totalClients: number;
}

function getStatus(): CollabStatus {
    const aw = awareness;
    if (!aw) return { peers: [], totalClients: 0 };
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

    return { peers, totalClients: states.size };
}

export function useCollabStatus(): CollabStatus {
    const [status, setStatus] = useState<CollabStatus>(getStatus);

    useEffect(() => {
        const update = () => setStatus(getStatus());
        const aw = awareness;
        if (!aw) {
            setStatus(getStatus());
            return;
        }
        aw.on("change", update);
        return () => { aw.off("change", update); };
    }, [providerEpoch]);

    return status;
}
