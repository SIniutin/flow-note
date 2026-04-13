import { useEffect, useState } from "react";
import { getCurrentUserId, setCurrentUserId, getUserById, type User, DEFAULT_USER_ID } from "./users";

const listeners = new Set<() => void>();

export function changeCurrentUser(id: string): void {
    setCurrentUserId(id);
    listeners.forEach(l => l());
}

export function useCurrentUser(): User {
    const [id, setId] = useState<string>(() => getCurrentUserId());
    useEffect(() => {
        const l = () => setId(getCurrentUserId());
        listeners.add(l);
        return () => { listeners.delete(l); };
    }, []);
    return getUserById(id) ?? getUserById(DEFAULT_USER_ID)!;
}