import { getAccessToken, handleUnauthorized } from "../data/authStore";

export interface BackendPage {
    id:          string;
    title:       string;
    description?: string;
    ownerId:     string;
    createdAt:   string;
    updatedAt:   string;
}

async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = getAccessToken();
    const headers: Record<string, string> = { ...(init.headers as Record<string, string> ?? {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (init.body) headers["Content-Type"] = "application/json";

    const res = await fetch(path, { ...init, headers });
    if (!res.ok) {
        if (res.status === 401) handleUnauthorized();
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

export type PermissionRole =
    | "PAGE_PERMISSION_ROLE_VIEWER"
    | "PAGE_PERMISSION_ROLE_COMMENTER"
    | "PAGE_PERMISSION_ROLE_EDITOR"
    | "PAGE_PERMISSION_ROLE_MENTOR";

export const ROLE_LABELS: Record<string, string> = {
    PAGE_PERMISSION_ROLE_VIEWER:    "Просмотр",
    PAGE_PERMISSION_ROLE_COMMENTER: "Комментирование",
    PAGE_PERMISSION_ROLE_EDITOR:    "Редактирование",
    PAGE_PERMISSION_ROLE_MENTOR:    "Управление",
    PAGE_PERMISSION_ROLE_OWNER:     "Владелец",
};

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

    update(pageId: string, patch: { title?: string; description?: string }): Promise<{ page: BackendPage }> {
        return authFetch(`/v1/pages/${encodeURIComponent(pageId)}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
        });
    },

    delete(pageId: string): Promise<void> {
        return authFetch(`/v1/pages/${encodeURIComponent(pageId)}`, { method: "DELETE" });
    },

    listPermissions(pageId: string): Promise<{ permissions: PagePermission[] }> {
        return authFetch(`/v1/pages/${encodeURIComponent(pageId)}/permissions`);
    },

    getMyPermission(pageId: string): Promise<{ permission: PagePermission }> {
        return authFetch(`/v1/pages/${encodeURIComponent(pageId)}/permissions/me`);
    },

    grantPermission(pageId: string, userId: string, role: PermissionRole): Promise<{ permission: PagePermission }> {
        return authFetch(`/v1/pages/${encodeURIComponent(pageId)}/permissions`, {
            method: "POST",
            body: JSON.stringify({ user_id: userId, role }),
        });
    },

    revokePermission(pageId: string, userId: string): Promise<void> {
        return authFetch(`/v1/pages/${encodeURIComponent(pageId)}/permissions/${encodeURIComponent(userId)}`, {
            method: "DELETE",
        });
    },

    getConnected(pageId: string): Promise<{ pages: BackendPage[]; links: BackendPageLink[] }> {
        return authFetch(`/v1/pages/${encodeURIComponent(pageId)}/connected`);
    },

    listVersions(pageId: string, limit = 100, offset = 0): Promise<{ versions: BackendVersion[] }> {
        return authFetch(`/v1/pages/${encodeURIComponent(pageId)}/versions?pagination.limit=${limit}&pagination.offset=${offset}`);
    },
};
