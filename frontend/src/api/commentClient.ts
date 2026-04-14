// ─── src/api/commentClient.ts ─────────────────────────────────────────────────
// HTTP клиент для CommentService (gRPC-gateway).
// Пути — gRPC-стиль (/comment.v1.CommentService/{Method}), т.к. proto не имеет
// google.api.http аннотаций. gRPC-gateway сериализует поля в lowerCamelCase.

import { getAccessToken } from "../data/authStore";

// ── Types (соответствуют proto comment.v1) ────────────────────────────────────

export interface ProtoComment {
    id:        string;
    userId:    string;
    parentId:  string;   // "" — корневой комментарий
    pageId:    string;
    bodyId:    string;
    deleted:   boolean;
    body:      string;
    createdAt: string;   // ISO от grpc Timestamp
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
    const token = getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
}

async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
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
    /**
     * Создать комментарий (или ответ, если указан parentId).
     * POST /comment.v1.CommentService/MakeComment
     */
    makeComment(params: {
        userId:   string;
        pageId:   string;
        body:     string;
        parentId?: string;
        bodyId?:   string;
    }): Promise<{ comment: ProtoComment }> {
        return post("/comment.v1.CommentService/MakeComment", {
            userId:   params.userId,
            pageId:   params.pageId,
            body:     params.body,
            parentId: params.parentId ?? "",
            bodyId:   params.bodyId   ?? "",
        });
    },

    /**
     * Список комментариев страницы.
     * POST /comment.v1.CommentService/ListComments
     */
    listComments(pageId: string): Promise<{ comments: ProtoComment[] }> {
        return post("/comment.v1.CommentService/ListComments", { pageId });
    },

    /**
     * Один комментарий по id.
     * POST /comment.v1.CommentService/GetComment
     */
    getComment(commentId: string): Promise<{ comment: ProtoComment }> {
        return post("/comment.v1.CommentService/GetComment", { commentId });
    },

    /**
     * Подписаться на уведомления о комментариях страницы.
     * POST /comment.v1.CommentService/SubscribeToComment
     */
    subscribe(userId: string, pageId: string): Promise<void> {
        return post("/comment.v1.CommentService/SubscribeToComment", { userId, pageId });
    },

    /**
     * Отписаться от уведомлений.
     * POST /comment.v1.CommentService/UnsubscribeToComment
     */
    unsubscribe(userId: string, pageId: string): Promise<void> {
        return post("/comment.v1.CommentService/UnsubscribeToComment", { userId, pageId });
    },
};
