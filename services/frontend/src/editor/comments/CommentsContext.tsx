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
        id:        c.bodyId || c.id,
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

/**
 * Сливает данные из API с локальным состоянием:
 * - Добавляет новые треды от других пользователей
 * - Добавляет новые ответы в существующие треды
 * - Не трогает локальные данные (orphaned, resolved) — они не хранятся на сервере
 */
function mergeFromApi(local: Thread[], fromApi: Thread[]): Thread[] {
    const apiMap = new Map(fromApi.map(t => [t.id, t]));
    let changed = false;

    const updated = local.map(localThread => {
        const apiThread = apiMap.get(localThread.id);
        if (!apiThread) return localThread;
        const localReplyIds = new Set(localThread.replies.map(r => r.id));
        const newReplies = apiThread.replies.filter(r => !localReplyIds.has(r.id));
        if (newReplies.length === 0) return localThread;
        changed = true;
        return { ...localThread, replies: [...localThread.replies, ...newReplies] };
    });

    const localIds = new Set(local.map(t => t.id));
    const newThreads = fromApi.filter(t => !localIds.has(t.id));

    if (!changed && newThreads.length === 0) return local;
    return [...updated, ...newThreads];
}

interface Props {
    children: ReactNode;
    pageId?: string;
}

export function CommentsProvider({ children, pageId }: Props) {
    const [threads, setThreads] = useState<Thread[]>(() => loadThreads(pageId));
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

    // Перезагружаем треды при смене страницы
    useEffect(() => {
        setThreads(loadThreads(pageId));
        setActiveThreadId(null);
    }, [pageId]);

    // Сохраняем в localStorage
    useEffect(() => { saveThreads(threads, pageId); }, [threads, pageId]);

    // ── Синхронизация с API ───────────────────────────────────────────────────
    const syncFromApi = useCallback(() => {
        if (!pageId || !getAccessToken()) return;
        commentClient.listComments(pageId)
            .then(res => {
                const items = res?.comments ?? [];
                if (items.length === 0) return;
                const fromApi = commentsToThreads(items);
                setThreads(prev => mergeFromApi(prev, fromApi));
            })
            .catch(() => {});
    }, [pageId]);

    // Начальная синхронизация при смене страницы
    useEffect(() => { syncFromApi(); }, [syncFromApi]);

    // ── Подписка на комментарии страницы + SSE-driven обновления ─────────────
    // Подписываемся, чтобы notify-service рассылал уведомления о новых
    // комментариях всем участникам страницы. Это позволяет NotificationsPopover
    // получать события через SSE и диспатчить wiki:comments-updated.
    useEffect(() => {
        if (!pageId || !getAccessToken()) return;
        commentClient.subscribe(pageId).catch(() => {});
        return () => {
            commentClient.unsubscribe(pageId).catch(() => {});
        };
    }, [pageId]);

    // Слушаем wiki:comments-updated — приходит от NotificationsPopover
    // когда SSE доставляет нотификацию о новом комментарии на этой странице.
    useEffect(() => {
        if (!pageId) return;
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ pageId: string }>).detail;
            if (detail?.pageId === pageId) syncFromApi();
        };
        window.addEventListener("wiki:comments-updated", handler);
        return () => window.removeEventListener("wiki:comments-updated", handler);
    }, [pageId, syncFromApi]);

    // ── Мутации ───────────────────────────────────────────────────────────────
    const addThread = useCallback((text: string, author: string, authorId: string, id?: string): Thread => {
        const threadId = id ?? newThreadId();
        const t: Thread = {
            id: threadId,
            author, authorId, text, resolved: false, orphaned: false, replies: [],
            createdAt: formatDate(),
        };
        setThreads(prev => [...prev, t]);

        if (pageId && getAccessToken()) {
            commentClient.makeComment({
                pageId,
                body:   text,
                bodyId: threadId,
            }).catch(() => {});
        }

        return t;
    }, [pageId]);

    const addReply = useCallback((threadId: string, text: string, author: string, authorId: string) => {
        if (!text.trim()) return;
        const replyId = newReplyId();
        setThreads(prev => prev.map(t => t.id === threadId
            ? { ...t, replies: [...t.replies, { id: replyId, author, authorId, text: text.trim(), createdAt: formatDate() }] }
            : t));

        if (pageId && getAccessToken()) {
            commentClient.makeComment({
                pageId,
                body:     text.trim(),
                bodyId:   threadId,
                parentId: threadId,
            }).catch(() => {});
        }
    }, [pageId]);

    const getThread      = useCallback((id: string) => threads.find(t => t.id === id), [threads]);
    const resolveThread  = useCallback((id: string) =>
        setThreads(prev => prev.map(t => t.id === id ? { ...t, resolved: true } : t)), []);
    const removeThread   = useCallback((id: string) =>
        setThreads(prev => prev.filter(t => t.id !== id)), []);
    const removeReply    = useCallback((threadId: string, replyId: string) =>
        setThreads(prev => prev.map(t => t.id === threadId
            ? { ...t, replies: t.replies.filter(r => r.id !== replyId) }
            : t)), []);
    const setOrphanedIds = useCallback((orphanedIds: Set<string>) => {
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
