// ─── src/api/notifyClient.ts ──────────────────────────────────────────────────
// HTTP клиент для NotifyService (gRPC-gateway, /api/v1/notifications)

import { getAccessToken } from "../data/authStore";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Notification {
    id: string;
    user_id: string;
    type: string;
    actor_user_id?: string;
    page_id?: string;
    thread_id?: string;
    comment_id?: string;
    payload_json: string;
    read: boolean;
    created_at: string;
    read_at?: string;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
    const token = getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(path, {
        method,
        headers: authHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        let message = text;
        try { message = JSON.parse(text).message ?? text; } catch { /* raw */ }
        throw new Error(message || `HTTP ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return undefined as T;
    return res.json();
}

// ── API ───────────────────────────────────────────────────────────────────────

export const notifyClient = {
    // GET /api/v1/notifications?unread_only=&only_mentions=&limit=&offset=
    listNotifications(opts: {
        unread_only?: boolean;
        only_mentions?: boolean;
        limit?: number;
        offset?: number;
    } = {}): Promise<{ items: Notification[] }> {
        const params = new URLSearchParams();
        if (opts.unread_only    !== undefined) params.set("unread_only",    String(opts.unread_only));
        if (opts.only_mentions  !== undefined) params.set("only_mentions",  String(opts.only_mentions));
        if (opts.limit          !== undefined) params.set("limit",          String(opts.limit));
        if (opts.offset         !== undefined) params.set("offset",         String(opts.offset));
        const qs = params.toString() ? `?${params}` : "";
        return request("GET", `/api/v1/notifications${qs}`);
    },

    // POST /api/v1/notifications/{notification_id}:mark-read
    markRead(notificationId: string): Promise<void> {
        return request("POST", `/api/v1/notifications/${notificationId}:mark-read`, {});
    },

    // POST /api/v1/notifications:mark-all-read
    markAllRead(): Promise<void> {
        return request("POST", `/api/v1/notifications:mark-all-read`, {});
    },
};
