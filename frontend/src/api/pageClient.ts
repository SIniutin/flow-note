// ─── src/api/pageClient.ts ────────────────────────────────────────────────────
// REST client for page CRUD operations.

import { getAccessToken } from "../data/authStore";

function authHeaders(): Record<string, string> {
    const token = getAccessToken();
    return token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" };
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { ...init, headers: { ...authHeaders(), ...init?.headers } });
    if (!res.ok) throw new Error(`[pageClient] ${res.status} ${url}`);
    return res.json() as Promise<T>;
}

interface BackendPage {
    id:        string;
    title:     string;
    createdAt: string;
    updatedAt: string;
}

export const pageClient = {
    async listAllowed(): Promise<{ pages: BackendPage[] }> {
        return req<{ pages: BackendPage[] }>("/v1/pages");
    },

    async create(title: string): Promise<{ page: BackendPage }> {
        return req<{ page: BackendPage }>("/v1/pages", {
            method: "POST",
            body: JSON.stringify({ title }),
        });
    },

    async delete(id: string): Promise<void> {
        await req(`/v1/pages/${id}`, { method: "DELETE" });
    },
} as const;
