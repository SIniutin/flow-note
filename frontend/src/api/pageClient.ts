// ─── src/api/pageClient.ts ────────────────────────────────────────────────────
// REST client for page-service (gRPC-gateway REST).

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

export interface BackendPage {
    id:        string;
    title:     string;
    ownerId?:  string;
    createdAt: string;
    updatedAt: string;
}

export interface BackendPageLink {
    id:         string;
    fromPageId: string;
    toPageId:   string;
    blockId:    string;
}

export interface BackendVersion {
    id:     number;
    pageId: string;
    date:   string;
    size:   number;
}

export const pageClient = {
    // GET /v1/pages/allowed
    listAllowed(): Promise<{ pages: BackendPage[] }> {
        return req("/v1/pages/allowed");
    },

    // POST /v1/pages
    create(title: string): Promise<{ page: BackendPage }> {
        return req("/v1/pages", {
            method: "POST",
            body: JSON.stringify({ title }),
        });
    },

    // DELETE /v1/pages/{page_id}
    delete(id: string): Promise<void> {
        return req(`/v1/pages/${id}`, { method: "DELETE" });
    },

    // GET /v1/pages/{page_id}/connected — входящие и исходящие ссылки
    getConnected(pageId: string): Promise<{ pages: BackendPage[]; links: BackendPageLink[] }> {
        return req(`/v1/pages/${pageId}/connected`);
    },

    // GET /v1/pages/{page_id}/versions
    listVersions(pageId: string): Promise<{ versions: BackendVersion[] }> {
        return req(`/v1/pages/${pageId}/versions`);
    },

    // GET /v1/pages/{page_id}/versions/latest
    getLastVersion(pageId: string): Promise<{ version: BackendVersion }> {
        return req(`/v1/pages/${pageId}/versions/latest`);
    },
} as const;
