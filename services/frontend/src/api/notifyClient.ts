// ─── src/api/notifyClient.ts ──────────────────────────────────────────────────
// HTTP клиент для NotificationService (gRPC-gateway REST).
// Swagger: api-contracts/docs/spec/proto/notify/v1/notify.swagger.json

import { getAccessToken, handleUnauthorized } from "../data/authStore";

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationType =
    | "NOTIFICATION_TYPE_UNSPECIFIED"
    | "NOTIFICATION_TYPE_MENTION_COMMENT"
    | "NOTIFICATION_TYPE_MENTION_PAGE"
    | "NOTIFICATION_TYPE_COMMENT_THREAD"
    | "NOTIFICATION_TYPE_COMMENT_REPLY"
    | "NOTIFICATION_TYPE_COMMENT_MENTION"
    | "NOTIFICATION_TYPE_GRAND_PERMISSION"
    | "NOTIFICATION_TYPE_REVOKE_PERMISSION";

export interface NotificationPayload {
    entityId?: string;
    pageId?:   string;
}

export interface Notification {
    id:           string;
    userId:       string;
    type:         NotificationType;
    actorUserId?: string;
    payload?:     NotificationPayload;
    createdAt:    string;
    readAt?:      string;
    cancelledAt?: string;
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
        if (res.status === 401) handleUnauthorized();
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
    // GET /v1/notify?pageSize=&unreadOnly=
    getNotifications(opts: { pageSize?: number; unreadOnly?: boolean } = {}):
        Promise<{ notifications: Notification[] }> {
        const params = new URLSearchParams();
        if (opts.pageSize  !== undefined) params.set("pageSize",   String(opts.pageSize));
        if (opts.unreadOnly !== undefined) params.set("unreadOnly", String(opts.unreadOnly));
        const qs = params.toString() ? `?${params}` : "";
        return request("GET", `/v1/notify${qs}`);
    },

    // POST /v1/notifications/{notificationId}/read
    markRead(notificationId: string): Promise<void> {
        return request("POST", `/v1/notifications/${encodeURIComponent(notificationId)}/read`, {});
    },

    // POST /v1/notifications:readAll
    markAllRead(): Promise<void> {
        return request("POST", "/v1/notifications:readAll", {});
    },
};

// ── Human-readable labels ──────────────────────────────────────────────────────

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
    NOTIFICATION_TYPE_UNSPECIFIED:      "Уведомление",
    NOTIFICATION_TYPE_MENTION_COMMENT:  "Упоминание в комментарии",
    NOTIFICATION_TYPE_MENTION_PAGE:     "Упоминание на странице",
    NOTIFICATION_TYPE_COMMENT_THREAD:   "Новый комментарий",
    NOTIFICATION_TYPE_COMMENT_REPLY:    "Ответ на комментарий",
    NOTIFICATION_TYPE_COMMENT_MENTION:  "Упоминание в комментарии",
    NOTIFICATION_TYPE_GRAND_PERMISSION: "Вам открыт доступ",
    NOTIFICATION_TYPE_REVOKE_PERMISSION:"Доступ отозван",
};
