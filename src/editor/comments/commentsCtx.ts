import {createContext} from "react";

export interface Reply {
    id: string;
    author: string;
    authorId?: string;
    text: string;
    createdAt: string;
}

export interface Thread {
    id: string;
    author: string;
    authorId?: string;
    createdAt: string;
    text: string;
    resolved: boolean;
    orphaned: boolean;
    replies: Reply[];
}

export interface CommentsContextValue {
    threads: Thread[];
    visibleThreads: Thread[];
    getThread: (id: string) => Thread | undefined;
    addThread: (text: string, author: string, authorId: string, id?: string) => Thread;
    addReply: (threadId: string, text: string, author: string, authorId: string) => void;
    resolveThread: (id: string) => void;
    removeThread: (id: string) => void;
    removeReply: (threadId: string, replyId: string) => void;
    setOrphanedIds: (orphanedIds: Set<string>) => void;
    activeThreadId: string | null;
    setActiveThreadId: (id: string | null) => void;
}

export const CommentsCtx = createContext<CommentsContextValue | null>(null);