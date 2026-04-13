// ─── src/editor/collab/useCollabStatus.ts ────────────────────────────────────
// Хук: статус подключения и список активных пользователей из awareness.

import { useEffect, useState } from "react";
import { awareness } from "./collabProvider";

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

export function useCollabStatus(): CollabStatus {
    const [status, setStatus] = useState<CollabStatus>(getStatus);

    useEffect(() => {
        const update = () => setStatus(getStatus());
        awareness.on("change", update);
        return () => { awareness.off("change", update); };
    }, []);

    return status;
}

function getStatus(): CollabStatus {
    const states = awareness.getStates();
    const myClientId = awareness.clientID;

    const peers: CollabUser[] = [];
    states.forEach((state, clientId) => {
        if (clientId === myClientId) return;
        const user = state.user as { name?: string; color?: string } | undefined;
        if (user?.name) {
            peers.push({
                clientId,
                name:  user.name,
                color: user.color ?? "#8b7cff",
            });
        }
    });

    return { peers, totalClients: states.size };
}
