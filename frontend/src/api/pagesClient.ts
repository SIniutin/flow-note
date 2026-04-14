// ─── src/api/pagesClient.ts ───────────────────────────────────────────────────
// REST client for PagesService (page.proto v1) — permissions & metadata.

import { getAccessToken } from "../data/authStore";
import type { PagePermission, PagePermissionRole } from "../types/pages";

function authHeaders(): Record<string, string> {
    const token = getAccessToken();
    return token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" };
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { ...init, headers: { ...authHeaders(), ...init?.headers } });
    if (!res.ok) throw new Error(`[pagesClient] ${res.status} ${url}`);
    return res.json() as Promise<T>;
}

export const pagesClient = {
    async listPermissions(pageId: string): Promise<PagePermission[]> {
        const data = await req<{ permissions: PagePermission[] }>(`/v1/pages/${pageId}/permissions`);
        return data.permissions ?? [];
    },

    async getMyPermission(pageId: string): Promise<PagePermission | null> {
        try {
            const data = await req<{ permission: PagePermission }>(`/v1/pages/${pageId}/permissions/me`);
            return data.permission ?? null;
        } catch { return null; }
    },

    async grantPermission(pageId: string, userId: string, role: PagePermissionRole): Promise<PagePermission> {
        const data = await req<{ permission: PagePermission }>(`/v1/pages/${pageId}/permissions`, {
            method: "POST",
            body: JSON.stringify({ user_id: userId, role: roleToProto(role) }),
        });
        return data.permission;
    },

    async updatePermission(pageId: string, userId: string, role: PagePermissionRole): Promise<void> {
        await req(`/v1/pages/${pageId}/permissions/${userId}`, {
            method: "PATCH",
            body: JSON.stringify({ role: roleToProto(role) }),
        });
    },

    async revokePermission(pageId: string, userId: string): Promise<void> {
        await req(`/v1/pages/${pageId}/permissions/${userId}`, { method: "DELETE" });
    },
} as const;

// proto enum string ↔ role string
function roleToProto(role: PagePermissionRole): string {
    return `PAGE_PERMISSION_ROLE_${role.toUpperCase()}`;
}
