// ─── src/editor/mwsTable/BacklinksChip.tsx ────────────────────────────────────
// Бейдж «📎 N ссылок» для footer MwsTableNodeView.
// При клике показывает небольшой дроп со списком документов.

import { useEffect, useRef, useState } from "react";
import { useBacklinksForTable } from "./backlinksStore";

interface Props {
    tableId: string;
}

export function BacklinksChip({ tableId }: Props) {
    const backlinks = useBacklinksForTable(tableId);
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    // Закрываем при клике вне
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    if (backlinks.length === 0) {
        return (
            <span style={styles.empty} title="Таблица не используется ни в одном документе">
                📎 Нет ссылок
            </span>
        );
    }

    return (
        <div ref={rootRef} style={{ position: "relative", display: "inline-block" }}>
            <button
                style={styles.chip}
                onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
                title="Документы, использующие эту таблицу"
            >
                📎 {backlinks.length} {plural(backlinks.length, "ссылка", "ссылки", "ссылок")}
            </button>

            {open && (
                <div style={styles.dropdown}>
                    <div style={styles.dropdownTitle}>Используется в:</div>
                    {backlinks.map(b => (
                        <div key={b.id} style={styles.dropdownItem}>
                            <span style={styles.docIcon}>📄</span>
                            <div>
                                <div style={styles.docTitle}>{b.docTitle}</div>
                                <div style={styles.docDate}>
                                    добавлено {new Date(b.insertedAt).toLocaleDateString("ru-RU", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function plural(n: number, one: string, few: string, many: string): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = {
    empty: {
        fontSize: 11,
        color: "var(--text-tertiary)",
    } as React.CSSProperties,

    chip: {
        fontSize: 11,
        fontWeight: 500,
        color: "var(--accent)",
        background: "var(--accent-soft)",
        border: "none",
        borderRadius: "var(--radius-pill)",
        padding: "2px 8px",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        transition: "background var(--dur-fast)",
    } as React.CSSProperties,

    dropdown: {
        position: "absolute" as const,
        bottom: "calc(100% + 6px)",
        left: 0,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-popover)",
        minWidth: 220,
        zIndex: 100,
        overflow: "hidden",
    } as React.CSSProperties,

    dropdownTitle: {
        fontSize: 11,
        fontWeight: 600,
        color: "var(--text-secondary)",
        padding: "8px 12px 4px",
        textTransform: "uppercase" as const,
        letterSpacing: ".04em",
        borderBottom: "1px solid var(--border-subtle)",
    } as React.CSSProperties,

    dropdownItem: {
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "8px 12px",
        borderBottom: "1px solid var(--border-subtle)",
    } as React.CSSProperties,

    docIcon: { fontSize: 14, flexShrink: 0, lineHeight: 1.4 } as React.CSSProperties,

    docTitle: {
        fontSize: 12,
        fontWeight: 500,
        color: "var(--text-primary)",
    } as React.CSSProperties,

    docDate: {
        fontSize: 11,
        color: "var(--text-tertiary)",
        marginTop: 1,
    } as React.CSSProperties,
} as const;
