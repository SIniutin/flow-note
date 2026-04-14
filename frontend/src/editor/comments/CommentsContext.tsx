import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { newThreadId } from "./id";
import { loadThreads, saveThreads } from "../persistence/storage";
import { CommentsCtx, type Thread, type Reply } from "./commentsCtx";
import { commentClient, type ProtoComment } from "../../api/commentClient";
import { getAccessToken } from "../../data/authStore";

const formatDate = () => new Date().toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
}).replace(",", " в");

const newReplyId = () => `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/** Конвертирует плоский список ProtoComment в иерархию Thread[]. */
function commentsToThreads(comments: ProtoComment[]): Thread[] {
    const rootComments = comments.filter(c => !c.parentId && !c.deleted);
    const byParent = new Map<string, ProtoComment[]>();
    comments.filter(c => c.parentId && !c.deleted).forEach(c => {
        const arr = byParent.get(c.parentId) ?? [];
        arr.push(c);
        byParent.set(c.parentId, arr);
    });

    return rootComments.map(c => ({
        id:        c.id,
        author:    c.userId,
        authorId:  c.userId,
        text:      c.body,
        createdAt: c.createdAt ?? formatDate(),
        resolved:  false,
        orphaned:  false,
        replies:   (byParent.get(c.id) ?? []).map(r => ({
            id:        r.id,
            author:    r.userId,
            authorId:  r.userId,
            text:      r.body,
            createdAt: r.createdAt ?? formatDate(),
        } satisfies Reply)),
    }));
}

interface Props {
    children: ReactNode;
    pageId?: string;
    currentUserId?: string;
}

export function CommentsProvider({ children, pageId, currentUserId }: Props) {
    const [threads, setThreads] = useState<Thread[]>(() => loadThreads(pageId));
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

    // Перезагружаем треды при смене страницы
    useEffect(() => {
        setThreads(loadThreads(pageId));
        setActiveThreadId(null);
    }, [pageId]);

    // Сохраняем в localStorage
    useEffect(() => { saveThreads(threads, pageId); }, [threads, pageId]);

    // Синхронизация с API при монтировании
    useEffect(() => {
        if (!pageId || !getAccessToken()) return;
        commentClient.listComments(pageId)
            .then(res => {
                const items = res?.comments ?? [];
                if (items.length === 0) return;
                const fromApi = commentsToThreads(items);
                setThreads(prev => {
                    const existingIds = new Set(prev.map(t => t.id));
                    const fresh = fromApi.filter(t => !existingIds.has(t.id));
                    return fresh.length > 0 ? [...prev, ...fresh] : prev;
                });
            })
            .catch(() => { /* API недоступен — работаем с localStorage */ });
    }, [pageId]);

    const addThread = useCallback((text: string, author: string, authorId: string, id?: string): Thread => {
        const t: Thread = {
            id: id ?? newThreadId(),
            author, authorId, text, resolved: false, orphaned: false, replies: [],
            createdAt: formatDate(),
        };
        setThreads(prev => [...prev, t]);

        if (pageId && getAccessToken() && currentUserId) {
            commentClient.makeComment({
                userId: currentUserId,
                pageId,
                body:   text,
            }).catch(() => { /* silent */ });
        }

        return t;
    }, [pageId, currentUserId]);

    const addReply = useCallback((threadId: string, text: string, author: string, authorId: string) => {
        if (!text.trim()) return;
        const replyId = newReplyId();
        setThreads(prev => prev.map(t => t.id === threadId
            ? { ...t, replies: [...t.replies, { id: replyId, author, authorId, text: text.trim(), createdAt: formatDate() }] }
            : t));

        if (pageId && getAccessToken() && currentUserId) {
            commentClient.makeComment({
                userId:   currentUserId,
                pageId:   pageId,
                body:     text.trim(),
                parentId: threadId,
            }).catch(() => { /* silent */ });
        }
    }, [pageId, currentUserId]);

    const getThread       = useCallback((id: string) => threads.find(t => t.id === id), [threads]);
    const resolveThread   = useCallback((id: string) =>
        setThreads(prev => prev.map(t => t.id === id ? { ...t, resolved: true } : t)), []);
    const removeThread    = useCallback((id: string) =>
        setThreads(prev => prev.filter(t => t.id !== id)), []);
    const removeReply     = useCallback((threadId: string, replyId: string) =>
        setThreads(prev => prev.map(t => t.id === threadId
            ? { ...t, replies: t.replies.filter(r => r.id !== replyId) }
            : t)), []);
    const setOrphanedIds  = useCallback((orphanedIds: Set<string>) => {
        setThreads(prev => {
            let changed = false;
            const next = prev.map(t => {
                const should = orphanedIds.has(t.id);
                if (t.orphaned !== should) { changed = true; return { ...t, orphaned: should }; }
                return t;
            });
            return changed ? next : prev;
        });
    }, []);

    const visibleThreads = useMemo(() => threads.filter(t => !t.orphaned), [threads]);

    const value = useMemo(() => ({
        threads, visibleThreads, getThread, addThread, addReply,
        resolveThread, removeThread, removeReply, setOrphanedIds,
        activeThreadId, setActiveThreadId,
    }), [threads, visibleThreads, getThread, addThread, addReply,
        resolveThread, removeThread, removeReply, setOrphanedIds, activeThreadId]);

    return <CommentsCtx.Provider value={value}>{children}</CommentsCtx.Provider>;
}
