import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { newThreadId } from "./id";
import { loadThreads, saveThreads } from "../persistence/storage";
import { CommentsCtx, type Thread } from "./commentsCtx";

const formatDate = () => new Date().toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
}).replace(",", " в");

const newReplyId = () => `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export function CommentsProvider({ children }: { children: ReactNode }) {
    const [threads, setThreads] = useState<Thread[]>(() => loadThreads());
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

    useEffect(() => { saveThreads(threads); }, [threads]);

    const addThread = useCallback((text: string, author: string, authorId: string, id?: string): Thread => {
        const t: Thread = {
            id: id ?? newThreadId(),
            author, authorId, text, resolved: false, orphaned: false, replies: [],
            createdAt: formatDate(),
        };
        setThreads(prev => [...prev, t]);
        return t;
    }, []);

    const addReply = useCallback((threadId: string, text: string, author: string, authorId: string) => {
        if (!text.trim()) return;
        setThreads(prev => prev.map(t => t.id === threadId
            ? { ...t, replies: [...t.replies, { id: newReplyId(), author, authorId, text: text.trim(), createdAt: formatDate() }] }
            : t));
    }, []);

    const getThread = useCallback((id: string) => threads.find(t => t.id === id), [threads]);
    const resolveThread = useCallback((id: string) =>
        setThreads(prev => prev.map(t => t.id === id ? { ...t, resolved: true } : t)), []);
    const removeThread = useCallback((id: string) =>
        setThreads(prev => prev.filter(t => t.id !== id)), []);
    const removeReply = useCallback((threadId: string, replyId: string) =>
        setThreads(prev => prev.map(t => t.id === threadId
            ? { ...t, replies: t.replies.filter(r => r.id !== replyId) }
            : t)), []);

    const setOrphanedIds = useCallback((orphanedIds: Set<string>) => {
        setThreads(prev => {
            let changed = false;
            const next = prev.map(t => {
                const shouldBeOrphaned = orphanedIds.has(t.id);
                if (t.orphaned !== shouldBeOrphaned) { changed = true; return { ...t, orphaned: shouldBeOrphaned }; }
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
    }), [threads, visibleThreads, getThread, addThread, addReply, resolveThread, removeThread, removeReply, setOrphanedIds, activeThreadId]);

    return <CommentsCtx.Provider value={value}>{children}</CommentsCtx.Provider>;
}