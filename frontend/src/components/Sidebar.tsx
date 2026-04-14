// ─── src/components/Sidebar.tsx ───────────────────────────────────────────────
// Боковая панель навигации по вики-страницам.

import { useState, useRef, useEffect } from "react";
import { usePages, pagesStore, type WikiPage } from "../data/pagesStore";
import "./sidebar.css";

interface SidebarProps {
    currentPageId: string;
    onNavigate: (pageId: string) => void;
    collapsed?: boolean;
    onToggle?: () => void;
}

export function Sidebar({ currentPageId, onNavigate, collapsed, onToggle }: SidebarProps) {
    const pages = usePages();
    const [search, setSearch] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const editRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingId && editRef.current) editRef.current.focus();
    }, [editingId]);

    const filtered = search
        ? pages.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))
        : pages;

    function handleCreate() {
        const page = pagesStore.create("Новая страница");
        onNavigate(page.id);
        setEditingId(page.id);
        setEditTitle(page.title);
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
        if (pages.length <= 1) return; // не удаляем последнюю
        if (!confirm("Удалить страницу?")) return;
        const nextId = pages.find(p => p.id !== id)?.id;
        pagesStore.delete(id);
        if (nextId) onNavigate(nextId);
    }

    if (collapsed) {
        return (
            <aside className="sidebar sidebar--collapsed">
                <button className="sidebar__toggle" onClick={onToggle} title="Развернуть панель">
                    <span>›</span>
                </button>
            </aside>
        );
    }

    return (
        <aside className="sidebar">
            <div className="sidebar__header">
                <span className="sidebar__logo">FlowNote</span>
                <button className="sidebar__toggle" onClick={onToggle} title="Свернуть панель">
                    <span>‹</span>
                </button>
            </div>

            <div className="sidebar__search-wrap">
                <input
                    className="sidebar__search"
                    placeholder="Поиск страниц…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <nav className="sidebar__nav">
                {filtered.length === 0 && (
                    <div className="sidebar__empty">Страниц не найдено</div>
                )}
                {filtered.map(page => (
                    <div
                        key={page.id}
                        className={`sidebar__item${page.id === currentPageId ? " sidebar__item--active" : ""}`}
                        onClick={() => {
                            if (editingId !== page.id) onNavigate(page.id);
                        }}
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
                            >✏️</button>
                            <button
                                title="Удалить"
                                onClick={e => handleDelete(page.id, e)}
                                disabled={pages.length <= 1}
                            >🗑️</button>
                        </div>
                    </div>
                ))}
            </nav>

            <button className="sidebar__new-page" onClick={handleCreate}>
                + Новая страница
            </button>
        </aside>
    );
}
