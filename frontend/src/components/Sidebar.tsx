// ─── src/components/Sidebar.tsx ───────────────────────────────────────────────

import { useState, useRef, useEffect } from "react";
import { usePages, pagesStore, type WikiPage } from "../data/pagesStore";
import { useAuth } from "../data/authStore";
import "./sidebar.css";

// ── SVG icons ─────────────────────────────────────────────────────────────────

function IconSearch() {
    return (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="6.5" cy="6.5" r="4.5"/>
            <line x1="10.5" y1="10.5" x2="14" y2="14"/>
        </svg>
    );
}

function IconPencil() {
    return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11.5 2.5a1.5 1.5 0 0 1 2 2L5 13H3v-2L11.5 2.5z"/>
        </svg>
    );
}

function IconTrash() {
    return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3,5 13,5"/>
            <path d="M5 5V3h6v2"/>
            <path d="M4 5l1 9h6l1-9"/>
        </svg>
    );
}

function IconChevronRight() {
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6,4 10,8 6,12"/>
        </svg>
    );
}

function IconChevronLeft() {
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="10,4 6,8 10,12"/>
        </svg>
    );
}

function IconPlus() {
    return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="8" y1="3" x2="8" y2="13"/>
            <line x1="3" y1="8" x2="13" y2="8"/>
        </svg>
    );
}

// ── Component ──────────────────────────────────────────────────────────────────

interface SidebarProps {
    currentPageId: string;
    onNavigate: (pageId: string) => void;
    collapsed?: boolean;
    onToggle?: () => void;
}

export function Sidebar({ currentPageId, onNavigate, collapsed, onToggle }: SidebarProps) {
    const pages = usePages();
    const { user } = useAuth();
    const [search, setSearch] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [createError, setCreateError] = useState<string | null>(null);
    const editRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingId && editRef.current) editRef.current.focus();
    }, [editingId]);

    const filtered = search
        ? pages.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))
        : pages;

    async function handleCreate() {
        setCreateError(null);
        try {
            const page = await pagesStore.create("Новая страница");
            onNavigate(page.id);
            setEditingId(page.id);
            setEditTitle(page.title);
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : "Не удалось создать страницу");
        }
    }

    function handleRename(page: WikiPage) {
        setEditingId(page.id);
        setEditTitle(page.title);
    }

    function commitRename() {
        if (editingId) {
            pagesStore.updateTitle(editingId, editTitle);
            setEditingId(null);
        }
    }

    function handleDelete(id: string, e: React.MouseEvent) {
        e.stopPropagation();
        if (pages.length <= 1) return;
        if (!confirm("Удалить страницу?")) return;
        const nextId = pages.find(p => p.id !== id)?.id;
        pagesStore.delete(id);
        if (nextId) onNavigate(nextId);
    }

    if (collapsed) {
        return (
            <button className="sidebar__collapsed-btn" onClick={onToggle} title="Открыть панель">
                <IconChevronRight/>
            </button>
        );
    }

    return (
        <aside className="sidebar">
            {/* Header */}
            <div className="sidebar__header">
                <div className="sidebar__workspace-icon">F</div>
                <div className="sidebar__workspace-info">
                    <span className="sidebar__logo">FlowNote</span>
                    <span className="sidebar__plan">{user?.login ?? user?.email ?? "…"}</span>
                </div>
                <button className="sidebar__toggle" onClick={onToggle} title="Свернуть панель">
                    <IconChevronLeft/>
                </button>
            </div>

            {/* Search */}
            <div className="sidebar__search-wrap">
                <div className="sidebar__search-inner">
                    <span className="sidebar__search-icon"><IconSearch/></span>
                    <input
                        className="sidebar__search"
                        placeholder="Поиск страниц…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Pages section */}
            <div className="sidebar__section-label">Страницы</div>

            <nav className="sidebar__nav">
                {filtered.length === 0 && (
                    <div className="sidebar__empty">
                        {search ? "Ничего не найдено" : "Нет страниц"}
                    </div>
                )}
                {filtered.map(page => (
                    <div
                        key={page.id}
                        className={`sidebar__item${page.id === currentPageId ? " sidebar__item--active" : ""}`}
                        onClick={() => { if (editingId !== page.id) onNavigate(page.id); }}
                    >
                        <span className="sidebar__item-icon">{page.icon ?? "📄"}</span>

                        {editingId === page.id ? (
                            <input
                                ref={editRef}
                                className="sidebar__item-input"
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                onBlur={commitRename}
                                onKeyDown={e => {
                                    if (e.key === "Enter") commitRename();
                                    if (e.key === "Escape") setEditingId(null);
                                }}
                                onClick={e => e.stopPropagation()}
                            />
                        ) : (
                            <span className="sidebar__item-title">{page.title}</span>
                        )}

                        <div className="sidebar__item-actions">
                            <button
                                title="Переименовать"
                                onClick={e => { e.stopPropagation(); handleRename(page); }}
                            >
                                <IconPencil/>
                            </button>
                            <button
                                className="danger"
                                title="Удалить"
                                onClick={e => handleDelete(page.id, e)}
                                disabled={pages.length <= 1}
                            >
                                <IconTrash/>
                            </button>
                        </div>
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="sidebar__footer">
                <button className="sidebar__new-page" onClick={() => void handleCreate()}>
                    <IconPlus/> Новая страница
                </button>
                {createError && (
                    <div style={{fontSize:"var(--fs-xs)",color:"var(--error,#e55)",padding:"4px 8px",wordBreak:"break-word"}}>
                        {createError}
                    </div>
                )}
            </div>
        </aside>
    );
}
