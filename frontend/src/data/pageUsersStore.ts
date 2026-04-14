// ─── src/data/pageUsersStore.ts ───────────────────────────────────────────────
// Список пользователей, имеющих доступ к текущей странице.
// Используется для @ mention в редакторе.
//
// Поток:
//   1. GET /v1/pages/{pageId}/permissions  → список { userId, role }
//   2. GET /v1/users/{id}                  → имя каждого пользователя (параллельно)

import { useEffect, useState } from "react";
import { pageClient } from "../api/pageClient";
import { authClient } from "../api/authClient";
import { getAccessToken } from "./authStore";

export interface PageUser {
    id:    string;
    login: string;
    email: string;
}

// ── State ─────────────────────────────────────────────────────────────────────

let _pageId: string | null = null;
let _users:  PageUser[]   = [];
let _loading = false;

const listeners = new Set<() => void>();
function notify() { listeners.forEach(l => l()); }

// ── Public API ────────────────────────────────────────────────────────────────

export const pageUsersStore = {
    getUsers(): PageUser[]  { return _users; },
    isLoading(): boolean    { return _loading; },

    /**
     * Загружает пользователей с доступом к странице.
     * Повторный вызов с тем же pageId не делает лишних запросов.
     */
    async load(pageId: string): Promise<void> {
        if (_pageId === pageId || _loading) return;
        _pageId  = pageId;
        _loading = true;
        _users   = [];
        notify();

        try {
            const { permissions } = await pageClient.listPermissions(pageId);
            const token = getAccessToken() ?? undefined;

            const settled = await Promise.allSettled(
                permissions.map(p => authClient.getById(p.userId, token))
            );

            _users = settled
                .flatMap((r, i) => {
                    if (r.status === "fulfilled") return [r.value.user];
                    console.warn("[pageUsers] failed to fetch user", permissions[i].userId);
                    return [];
                })
                .map(u => ({ id: u.id, login: u.login, email: u.email }));
        } catch (err) {
            console.warn("[pageUsersStore] load failed:", err);
            _users = [];
        } finally {
            _loading = false;
            notify();
        }
    },

    /** Сбрасывает кэш при смене страницы. */
    reset(pageId: string): void {
        if (_pageId !== pageId) {
            _pageId = null;
            _users  = [];
            notify();
        }
    },

    subscribe(l: () => void): () => void {
        listeners.add(l);
        return () => { listeners.delete(l); };
    },

    /** Фильтрует по query (login или email). */
    filter(query: string): PageUser[] {
        const q = query.trim().toLowerCase();
        if (!q) return _users;
        return _users.filter(
            u => u.login.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
        );
    },
};

// ── React hook ────────────────────────────────────────────────────────────────

export function usePageUsers(pageId: string | undefined): PageUser[] {
    const [, tick] = useState(0);

    useEffect(() => {
        const unsub = pageUsersStore.subscribe(() => tick(t => t + 1));
        return unsub;
    }, []);

    useEffect(() => {
        if (!pageId) return;
        pageUsersStore.reset(pageId);
        void pageUsersStore.load(pageId);
    }, [pageId]);

    return pageUsersStore.getUsers();
}
