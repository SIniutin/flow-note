// ─── src/data/pageUsersStore.ts ───────────────────────────────────────────────
// Список пользователей, у которых есть доступ к текущей странице.
// Используется для @-упоминаний в редакторе.

import { getAccessToken } from "./authStore";

export interface PageUser {
    id:    string;
    login: string;
    email: string;
}

let _users:   PageUser[] = [];
let _loading: boolean    = false;

export const pageUsersStore = {
    reset(_pageId: string): void {
        _users   = [];
        _loading = false;
    },

    async load(pageId: string): Promise<void> {
        _loading = true;
        try {
            const token = getAccessToken();
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const res = await fetch(`/v1/pages/${pageId}/permissions`, { headers });
            if (!res.ok) return;
            const data = await res.json() as {
                permissions?: Array<{ user?: { id: string; login: string; email: string } }>;
            };
            _users = (data.permissions ?? [])
                .map(p => p.user)
                .filter((u): u is PageUser => !!u?.id);
        } catch {
            // silently ignore — mentions will just be empty
        } finally {
            _loading = false;
        }
    },

    filter(query: string): PageUser[] {
        const q = query.toLowerCase();
        return q
            ? _users.filter(u => u.login.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
            : _users;
    },

    isLoading(): boolean {
        return _loading;
    },
};
