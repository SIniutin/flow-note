import type { Thread, Reply } from "../comments/commentsCtx";

const KEY_DOC     = (pageId: string) => `editor:doc:${pageId}:v1`;
const KEY_THREADS = (pageId: string) => `editor:threads:${pageId}:v1`;

// ── Backward compat keys (single-page era) ────────────────────────────────────
const LEGACY_DOC_KEY     = "editor:doc:v1";
const LEGACY_THREADS_KEY = "editor:threads:v1";

export function loadDoc(pageId?: string): string | null {
    try {
        if (pageId) {
            // Если pageId задан — берём только per-page ключ.
            // Legacy-ключ не используем: он от другой страницы и показал бы
            // чужой контент всем новым страницам.
            const paged = localStorage.getItem(KEY_DOC(pageId));
            return paged && paged.trim() ? paged : null;
        }
        // pageId не задан (старый однострановый режим) — берём legacy
        const legacy = localStorage.getItem(LEGACY_DOC_KEY);
        return legacy && legacy.trim() ? legacy : null;
    } catch { return null; }
}

export function saveDoc(html: string, pageId?: string): void {
    if (!html || !html.trim() || html === "<p></p>") return;
    const key = pageId ? KEY_DOC(pageId) : LEGACY_DOC_KEY;
    try { localStorage.setItem(key, html); }
    catch (e) { console.warn("Failed to save doc:", e); }
}

export function loadThreads(pageId?: string): Thread[] {
    try {
        const raw = pageId
            ? (localStorage.getItem(KEY_THREADS(pageId)) ?? localStorage.getItem(LEGACY_THREADS_KEY))
            : localStorage.getItem(LEGACY_THREADS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((t: Partial<Thread>) => ({
            id:       String(t.id ?? ""),
            author:   String(t.author ?? ""),
            authorId: t.authorId ? String(t.authorId) : undefined,
            createdAt: String(t.createdAt ?? ""),
            text:     String(t.text ?? ""),
            resolved: Boolean(t.resolved),
            orphaned: Boolean(t.orphaned),
            replies:  Array.isArray(t.replies)
                ? (t.replies as Partial<Reply>[]).map(r => ({
                    id:       String(r.id ?? ""),
                    author:   String(r.author ?? ""),
                    authorId: r.authorId ? String(r.authorId) : undefined,
                    text:     String(r.text ?? ""),
                    createdAt: String(r.createdAt ?? ""),
                })).filter(r => r.id)
                : [],
        })).filter(t => t.id);
    } catch { return []; }
}

export function saveThreads(threads: Thread[], pageId?: string): void {
    const key = pageId ? KEY_THREADS(pageId) : LEGACY_THREADS_KEY;
    try { localStorage.setItem(key, JSON.stringify(threads)); }
    catch (e) { console.warn("Failed to save threads:", e); }
}

export function clearAll(pageId?: string): void {
    try {
        if (pageId) {
            localStorage.removeItem(KEY_DOC(pageId));
            localStorage.removeItem(KEY_THREADS(pageId));
        } else {
            localStorage.removeItem(LEGACY_DOC_KEY);
            localStorage.removeItem(LEGACY_THREADS_KEY);
        }
    } catch { /* ignore */ }
}
