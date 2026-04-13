import type { Thread, Reply } from "../comments/commentsCtx";

const KEY_DOC = "editor:doc:v1";
const KEY_THREADS = "editor:threads:v1";

export function loadDoc(): string | null {
    try {
        const v = localStorage.getItem(KEY_DOC);
        return v && v.trim() ? v : null;
    } catch { return null; }
}

export function saveDoc(html: string): void {
    if (!html || !html.trim() || html === "<p></p>") return;
    try { localStorage.setItem(KEY_DOC, html); }
    catch (e) { console.warn("Failed to save doc:", e); }
}

export function loadThreads(): Thread[] {
    try {
        const raw = localStorage.getItem(KEY_THREADS);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((t: Partial<Thread>) => ({
            id: String(t.id ?? ""),
            author: String(t.author ?? ""),
            authorId: t.authorId ? String(t.authorId) : undefined,
            createdAt: String(t.createdAt ?? ""),
            text: String(t.text ?? ""),
            resolved: Boolean(t.resolved),
            orphaned: Boolean(t.orphaned),
            replies: Array.isArray(t.replies)
                ? (t.replies as Partial<Reply>[]).map(r => ({
                    id: String(r.id ?? ""),
                    author: String(r.author ?? ""),
                    authorId: r.authorId ? String(r.authorId) : undefined,
                    text: String(r.text ?? ""),
                    createdAt: String(r.createdAt ?? ""),
                })).filter(r => r.id)
                : [],
        })).filter(t => t.id);
    } catch { return []; }
}

export function saveThreads(threads: Thread[]): void {
    try { localStorage.setItem(KEY_THREADS, JSON.stringify(threads)); }
    catch (e) { console.warn("Failed to save threads:", e); }
}

export function clearAll(): void {
    try {
        localStorage.removeItem(KEY_DOC);
        localStorage.removeItem(KEY_THREADS);
    } catch { /* ignore */ }
}