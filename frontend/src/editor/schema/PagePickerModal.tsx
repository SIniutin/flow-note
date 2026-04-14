// ─── src/editor/schema/PagePickerModal.tsx ────────────────────────────────────
// Модал для выбора страницы при вставке page_link через slash-menu.
// Открывается через window event "wiki:open-page-picker".

import { useEffect, useState, useRef } from "react";
import { usePages } from "../../data/pagesStore";
import type { WikiPage } from "../../data/pagesStore";

interface PickerPayload {
    onSelect: (page: WikiPage) => void;
}

// Глобальный стор
let _resolver: ((page: WikiPage | null) => void) | null = null;

export function openPagePicker(): Promise<WikiPage | null> {
    return new Promise(resolve => {
        _resolver = resolve;
        window.dispatchEvent(new CustomEvent("wiki:open-page-picker"));
    });
}

export function PagePickerModal() {
    const pages = usePages();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = () => { setOpen(true); setSearch(""); };
        window.addEventListener("wiki:open-page-picker", handler);
        return () => window.removeEventListener("wiki:open-page-picker", handler);
    }, []);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 50);
    }, [open]);

    function close(page: WikiPage | null) {
        setOpen(false);
        _resolver?.(page);
        _resolver = null;
    }

    if (!open) return null;

    const filtered = search
        ? pages.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))
        : pages;

    return (
        <div className="modal-backdrop" onClick={() => close(null)}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, width: "100%" }}>
                <div className="modal-header">
                    <h3>Выбрать страницу</h3>
                    <button className="modal-close" onClick={() => close(null)}>✕</button>
                </div>
                <div style={{ padding: "8px 16px" }}>
                    <input
                        ref={inputRef}
                        placeholder="Поиск страниц…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: "100%", boxSizing: "border-box",
                            padding: "6px 10px",
                            border: "1px solid var(--border-default)",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--bg-surface)",
                            color: "var(--text-primary)",
                            fontSize: "var(--fs-sm)",
                            outline: "none",
                        }}
                        onKeyDown={e => {
                            if (e.key === "Escape") close(null);
                            if (e.key === "Enter" && filtered.length > 0) close(filtered[0]);
                        }}
                    />
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto", padding: "4px 8px 12px" }}>
                    {filtered.length === 0 && (
                        <div style={{ color: "var(--text-tertiary)", padding: "12px", textAlign: "center", fontSize: "var(--fs-sm)" }}>
                            Страницы не найдены
                        </div>
                    )}
                    {filtered.map(page => (
                        <button
                            key={page.id}
                            onClick={() => close(page)}
                            style={{
                                display: "flex", alignItems: "center", gap: 8,
                                width: "100%", textAlign: "left",
                                padding: "8px 10px",
                                background: "none",
                                border: "none",
                                borderRadius: "var(--radius-sm)",
                                cursor: "pointer",
                                color: "var(--text-primary)",
                                fontSize: "var(--fs-sm)",
                                transition: "background 0.1s",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "none")}
                        >
                            <span>{page.icon ?? "📄"}</span>
                            <span>{page.title}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
