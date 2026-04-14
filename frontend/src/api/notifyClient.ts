// ─── src/api/notifyClient.ts ──────────────────────────────────────────────────
// HTTP клиент для NotifyService (gRPC-gateway, /api/v1/notifications).
// Swagger: api-contracts/docs/spec/proto/notify/v1/notify.swagger.json

import { getAccessToken } from "../data/authStore";

// ── Types (camelCase — соответствует swagger v1Notification) ──────────────────

export interface Notification {
    id:           string;
    userId:       string;
    type:         string;
    actorUserId?: string;
    pageId?:      string;
    threadId?:    string;
    commentId?:   string;
    payloadJson:  string;
    read:         boolean;
    createdAt:    string;
    readAt?:      string;
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
    // GET /api/v1/notifications?unreadOnly=&onlyMentions=&limit=&offset=
    listNotifications(opts: {
        unreadOnly?:   boolean;
        onlyMentions?: boolean;
        limit?:        number;
        offset?:       number;
    } = {}): Promise<{ items: Notification[] }> {
        const params = new URLSearchParams();
        if (opts.unreadOnly   !== undefined) params.set("unreadOnly",   String(opts.unreadOnly));
        if (opts.onlyMentions !== undefined) params.set("onlyMentions", String(opts.onlyMentions));
        if (opts.limit        !== undefined) params.set("limit",        String(opts.limit));
        if (opts.offset       !== undefined) params.set("offset",       String(opts.offset));
        const qs = params.toString() ? `?${params}` : "";
        return request("GET", `/api/v1/notifications${qs}`);
    },

    // POST /api/v1/notifications/{notificationId}:mark-read
    markRead(notificationId: string): Promise<void> {
        return request("POST", `/api/v1/notifications/${encodeURIComponent(notificationId)}:mark-read`, {});
    },

    // POST /api/v1/notifications:mark-all-read
    markAllRead(): Promise<void> {
        return request("POST", `/api/v1/notifications:mark-all-read`, {});
    },
};
