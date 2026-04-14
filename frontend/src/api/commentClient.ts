// ─── src/api/commentClient.ts ─────────────────────────────────────────────────
// HTTP клиент для CommentService (gRPC-gateway, /api/v1/*)

import { getAccessToken } from "../data/authStore";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Anchor {
    kind: string;
    block_id: string;
    start_offset?: number;
    end_offset?: number;
    selected_text: string;
    context_before: string;
    context_after: string;
    snapshot_id?: string;
    table_id?: string;
    row_id?: string;
    column_id?: string;
}

export interface BodyNode {
    type: string;
    text: string;
    label?: string;
    user_id?: string;
}

export interface Thread {
    id: string;
    page_id: string;
    anchor: Anchor;
    anchor_hash: string;
    created_by: string;
    status: string;
    created_at: string;
    updated_at: string;
    resolved_by?: string;
    resolved_at?: string;
    last_commented_at?: string;
    comments_count: number;
}

export interface Comment {
    id: string;
    thread_id: string;
    parent_comment_id?: string;
    author_id: string;
    body: BodyNode[];
    body_text: string;
    created_at: string;
    updated_at: string;
    edited_at?: string;
    deleted_at?: string;
    status: string;
}

export interface ThreadWithComments {
    thread: Thread;
    comments: Comment[];
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
    const token = getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
}

async function request<T>(
    method: string,
    path: string,
    body?: unknown,
): Promise<T> {
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

export const commentClient = {
    // POST /api/v1/pages/{page_id}/threads
    createThread(
        pageId: string,
        anchor: Anchor,
        body: BodyNode[],
    ): Promise<{ thread: Thread; root_comment: Comment }> {
        return request("POST", `/api/v1/pages/${pageId}/threads`, { anchor, body });
    },

    // GET /api/v1/pages/{page_id}/threads?active_only=&limit=&offset=
    listThreads(
        pageId: string,
        opts: { active_only?: boolean; limit?: number; offset?: number } = {},
    ): Promise<{ items: Thread[] }> {
        const params = new URLSearchParams();
        if (opts.active_only !== undefined) params.set("active_only", String(opts.active_only));
        if (opts.limit     !== undefined) params.set("limit",       String(opts.limit));
        if (opts.offset    !== undefined) params.set("offset",      String(opts.offset));
        const qs = params.toString() ? `?${params}` : "";
        return request("GET", `/api/v1/pages/${pageId}/threads${qs}`);
    },

    // GET /api/v1/pages/{page_id}/discussions
    listDiscussions(
        pageId: string,
        opts: { limit?: number; offset?: number } = {},
    ): Promise<{ items: Thread[] }> {
        const params = new URLSearchParams();
        if (opts.limit  !== undefined) params.set("limit",  String(opts.limit));
        if (opts.offset !== undefined) params.set("offset", String(opts.offset));
        const qs = params.toString() ? `?${params}` : "";
        return request("GET", `/api/v1/pages/${pageId}/discussions${qs}`);
    },

    // GET /api/v1/threads/{thread_id}
    getThread(threadId: string): Promise<{ item: ThreadWithComments }> {
        return request("GET", `/api/v1/threads/${threadId}`);
    },

    // POST /api/v1/threads/{thread_id}/replies
    addReply(threadId: string, body: BodyNode[]): Promise<{ comment: Comment }> {
        return request("POST", `/api/v1/threads/${threadId}/replies`, { body });
    },

    // POST /api/v1/threads/{thread_id}:resolve
    resolveThread(threadId: string): Promise<void> {
        return request("POST", `/api/v1/threads/${threadId}:resolve`, {});
    },

    // POST /api/v1/threads/{thread_id}:reopen
    reopenThread(threadId: string): Promise<void> {
        return request("POST", `/api/v1/threads/${threadId}:reopen`, {});
    },

    // DELETE /api/v1/comments/{comment_id}
    deleteComment(commentId: string): Promise<void> {
        return request("DELETE", `/api/v1/comments/${commentId}`);
    },

    // POST /api/v1/threads/{thread_id}:follow
    followThread(threadId: string): Promise<void> {
        return request("POST", `/api/v1/threads/${threadId}:follow`, {});
    },

    // POST /api/v1/threads/{thread_id}:unfollow
    unfollowThread(threadId: string): Promise<void> {
        return request("POST", `/api/v1/threads/${threadId}:unfollow`, {});
    },
};
