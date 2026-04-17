// ─── src/api/commentClient.ts ─────────────────────────────────────────────────
// HTTP клиент для CommentService (gRPC-gateway REST).
// Swagger: api-contracts/docs/spec/proto/comment/v1/comment.swagger.json

import { getAccessToken, handleUnauthorized } from "../data/authStore";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProtoComment {
    id:        string;
    userId:    string;
    parentId:  string;
    pageId:    string;
    bodyId:    string;   // = threadId (comment mark ID)
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
        if (res.status === 401) handleUnauthorized();
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
    // GET /v1/comments?pageId=...
    listComments(pageId: string): Promise<{ comments: ProtoComment[] }> {
        return request("GET", `/v1/comments?pageId=${encodeURIComponent(pageId)}`);
    },

    // POST /v1/comments
    // userId is taken from JWT — not sent in body
    makeComment(params: {
        pageId:    string;
        body:      string;
        bodyId?:   string;  // threadId (comment mark ID)
        parentId?: string;
    }): Promise<{ comment: ProtoComment }> {
        return request("POST", "/v1/comments", {
            pageId:   params.pageId,
            body:     params.body,
            bodyId:   params.bodyId  ?? "",
            parentId: params.parentId ?? "",
        });
    },

    // GET /v1/comments/{commentId}
    getComment(commentId: string): Promise<{ comment: ProtoComment }> {
        return request("GET", `/v1/comments/${encodeURIComponent(commentId)}`);
    },

    // POST /v1/comments/subscriptions
    subscribe(pageId: string): Promise<void> {
        return request("POST", "/v1/comments/subscriptions", { pageId });
    },

    // DELETE /v1/comments/subscriptions/{pageId}
    unsubscribe(pageId: string): Promise<void> {
        return request("DELETE", `/v1/comments/subscriptions/${encodeURIComponent(pageId)}`);
    },
};
