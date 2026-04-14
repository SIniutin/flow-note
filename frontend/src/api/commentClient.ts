// ─── src/api/commentClient.ts ─────────────────────────────────────────────────
// HTTP клиент для CommentService (gRPC-gateway REST).
// Пути и методы берутся из swagger: api-contracts/docs/spec/proto/comment/v1/comment.swagger.json

import { getAccessToken } from "../data/authStore";

// ── Types (соответствуют swagger comment.v1) ──────────────────────────────────

export interface ProtoComment {
    id:        string;
    userId:    string;
    parentId:  string;
    pageId:    string;
    bodyId:    string;
    deleted:   boolean;
    body:      string;
    createdAt: string;
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
    return res.json();
}

// ── API ───────────────────────────────────────────────────────────────────────

export const commentClient = {
    // POST /v1/comments
    makeComment(params: {
        userId:    string;
        pageId:    string;
        body:      string;
        parentId?: string;
        bodyId?:   string;
    }): Promise<{ comment: ProtoComment }> {
        return request("POST", "/v1/comments", {
            userId:   params.userId,
            pageId:   params.pageId,
            body:     params.body,
            parentId: params.parentId ?? "",
            bodyId:   params.bodyId   ?? "",
        });
    },

    // GET /v1/comments?pageId=...
    listComments(pageId: string): Promise<{ comments: ProtoComment[] }> {
        return request("GET", `/v1/comments?pageId=${encodeURIComponent(pageId)}`);
    },

    // GET /v1/comments/{commentId}
    getComment(commentId: string): Promise<{ comment: ProtoComment }> {
        return request("GET", `/v1/comments/${encodeURIComponent(commentId)}`);
    },

    // POST /v1/comments/subscriptions
    subscribe(userId: string, pageId: string): Promise<void> {
        return request("POST", "/v1/comments/subscriptions", { userId, pageId });
    },

    // DELETE /v1/comments/subscriptions/{pageId}/{userId}
    unsubscribe(userId: string, pageId: string): Promise<void> {
        return request("DELETE", `/v1/comments/subscriptions/${encodeURIComponent(pageId)}/${encodeURIComponent(userId)}`);
    },
};
