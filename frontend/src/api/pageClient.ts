import { getAccessToken } from "../data/authStore";

export interface BackendPage {
    id:        string;
    title:     string;
    ownerId:   string;
    createdAt: string;
    updatedAt: string;
}

async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = getAccessToken();
    const headers: Record<string, string> = { ...(init.headers as Record<string, string> ?? {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (init.body) headers["Content-Type"] = "application/json";

    const res = await fetch(path, { ...init, headers });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        let message = text;
        try { message = JSON.parse(text).message ?? text; } catch { /* raw text */ }
        throw new Error(message || `HTTP ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return undefined as T;
    return res.json() as T;
}

export interface PagePermission {
    id:        string;
    pageId:    string;
    userId:    string;
    role:      string;
    grantedBy: string;
}

export const pageClient = {
    listAllowed(): Promise<{ pages: BackendPage[] }> {
        return authFetch("/v1/pages/allowed?pagination.limit=100&pagination.offset=0");
    },

    create(title: string): Promise<{ page: BackendPage }> {
        return authFetch("/v1/pages", { method: "POST", body: JSON.stringify({ title }) });
    },

    delete(pageId: string): Promise<void> {
        return authFetch(`/v1/pages/${encodeURIComponent(pageId)}`, { method: "DELETE" });
    },

    listPermissions(pageId: string): Promise<{ permissions: PagePermission[] }> {
        return authFetch(`/v1/pages/${encodeURIComponent(pageId)}/permissions`);
    },
};
