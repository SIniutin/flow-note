// ─── src/editor/mwsTable/MwsTableNodeView.tsx ────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { tablesClient } from "../../api/tablesClient";
import { BacklinksChip } from "./BacklinksChip";
import type { MwsTable, MwsTableNodeAttrs, MwsColumnType } from "../../types/mwsTable";
import "./mwsTableNodeView.css";

// ── helpers ───────────────────────────────────────────────────────────────────

const MODE_LABELS: Record<MwsTableNodeAttrs["viewMode"], string> = {
    compact: "Compact",
    full: "Full",
    card: "Card",
};

function formatCell(value: unknown, type: MwsColumnType): string {
    if (value === null || value === undefined) return "—";
    if (type === "boolean") return value ? "✓" : "✗";
    if (type === "date") {
        try { return new Date(String(value)).toLocaleDateString("ru-RU"); }
        catch { return String(value); }
    }
    if (type === "url") {
        try { return new URL(String(value)).hostname; }
        catch { return String(value); }
    }
    return String(value);
}

const STATUS_CLASS: Record<string, string> = {
    "in progress": "mws-badge--in-progress",
    "planned":     "mws-badge--planned",
    "done":        "mws-badge--done",
    "critical":    "mws-badge--critical",
    "medium":      "mws-badge--medium",
    "low":         "mws-badge--low",
};

function StatusBadge({ value }: { value: string }) {
    const cls = STATUS_CLASS[value.toLowerCase()] ?? "mws-badge--default";
    return <span className={`mws-badge ${cls}`}>{value}</span>;
}

function CellValue({ value, type }: { value: unknown; type: MwsColumnType }) {
    if (type === "url" && value) {
        return (
            <a
                className="mws-link"
                href={String(value)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
            >
                {formatCell(value, type)}
            </a>
        );
    }
    return <span>{formatCell(value, type)}</span>;
}

function Skeleton({ width }: { width: number | string }) {
    return <span className="mws-skeleton" style={{ width }} />;
}

// ── main component ────────────────────────────────────────────────────────────

export function MwsTableNodeView({ node, selected, updateAttributes }: NodeViewProps) {
    const attrs = node.attrs as MwsTableNodeAttrs;
    const { tableId, viewMode, maxRows = 5, caption } = attrs;

    const [table, setTable] = useState<MwsTable | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [modeMenuOpen, setModeMenuOpen] = useState(false);

    const modeMenuRef = useRef<HTMLDivElement>(null);

    // ── загрузка ──────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!tableId) { setLoading(false); setError("Таблица не выбрана"); return; }
        setLoading(true);
        setError(null);
        tablesClient.getTable(tableId)
            .then(t => {
                if (!t) setError(`Таблица "${tableId}" не найдена`);
                else setTable(t);
            })
            .catch(() => setError("Ошибка загрузки таблицы"))
            .finally(() => setLoading(false));
    }, [tableId]);

    // ── закрытие меню режимов ─────────────────────────────────────────────────

    useEffect(() => {
        if (!modeMenuOpen) return;
        const handler = (e: MouseEvent) => {
            if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
                setModeMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [modeMenuOpen]);

    const handleModeChange = useCallback((mode: MwsTableNodeAttrs["viewMode"]) => {
        updateAttributes({ viewMode: mode });
        setModeMenuOpen(false);
    }, [updateAttributes]);

    // ── производные ───────────────────────────────────────────────────────────

    const visibleRows = table
        ? (expanded ? table.rows : table.rows.slice(0, maxRows))
        : [];

    const visibleColumns = (
        viewMode === "compact" && attrs.pinnedColumns?.length
            ? (table?.columns.filter(c => attrs.pinnedColumns!.includes(c.id)) ?? [])
            : (table?.columns ?? [])
    );

    const nodeClass = `mws-node${selected ? " is-selected" : ""}`;

    // ── состояния: нет tableId ─────────────────────────────────────────────────

    if (!tableId) {
        return (
            <NodeViewWrapper as="div" className={nodeClass}>
                <div className="mws-node__empty">
                    <span>📋</span>
                    <span>Таблица не выбрана — используйте / для вставки</span>
                </div>
            </NodeViewWrapper>
        );
    }

    // ── состояние: загрузка ────────────────────────────────────────────────────

    if (loading) {
        return (
            <NodeViewWrapper as="div" className={nodeClass}>
                <div className="mws-node__head">
                    <Skeleton width={130} />
                    <Skeleton width={60} />
                </div>
                <div className="mws-node__scroll">
                    <table className="mws-node__table">
                        <thead>
                            <tr>
                                {[180, 100, 120, 100].map((w, i) => (
                                    <th key={i} className="mws-node__th">
                                        <Skeleton width={w * 0.55} />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[0, 1, 2].map(r => (
                                <tr key={r}>
                                    {[180, 100, 120, 100].map((w, c) => (
                                        <td key={c} className="mws-node__td">
                                            <Skeleton width={w * 0.75} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </NodeViewWrapper>
        );
    }

    // ── состояние: ошибка ──────────────────────────────────────────────────────

    if (error || !table) {
        return (
            <NodeViewWrapper as="div" className={nodeClass}>
                <div className="mws-node__error">
                    <span>⚠️</span>
                    <span>{error ?? "Неизвестная ошибка"}</span>
                </div>
            </NodeViewWrapper>
        );
    }

    // ── шапка (общая для всех режимов) ────────────────────────────────────────

    const head = (
        <div className="mws-node__head">
            <span className="mws-node__icon">{table.icon}</span>
            <span className="mws-node__name">{caption ?? table.name}</span>
            {viewMode !== "card" && table.description && (
                <span className="mws-node__desc">{table.description}</span>
            )}
            {/* переключатель режима */}
            <div className="mws-node__mode-wrap" ref={modeMenuRef}>
                <button
                    className="mws-node__mode-btn"
                    onClick={e => { e.stopPropagation(); setModeMenuOpen(v => !v); }}
                    title="Режим отображения"
                >
                    {MODE_LABELS[viewMode]} ▾
                </button>
                {modeMenuOpen && (
                    <div className="mws-node__mode-menu">
                        {(Object.keys(MODE_LABELS) as MwsTableNodeAttrs["viewMode"][]).map(m => (
                            <button
                                key={m}
                                className={`mws-node__mode-item${m === viewMode ? " is-active" : ""}`}
                                onClick={e => { e.stopPropagation(); handleModeChange(m); }}
                            >
                                {MODE_LABELS[m]}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    // ── футер ─────────────────────────────────────────────────────────────────

    const foot = (
        <div className="mws-node__foot">
            <BacklinksChip tableId={tableId} />
            <span>
                {table.rows.length} строк · {table.columns.length} колонок
            </span>
            <span>
                Обновлено{" "}
                {new Date(table.updatedAt).toLocaleDateString("ru-RU", {
                    day: "numeric", month: "short", year: "numeric",
                })}
            </span>
        </div>
    );

    // ── expand-кнопка ─────────────────────────────────────────────────────────

    const expandBtn = table.rows.length > maxRows && (
        <button
            className="mws-node__expand"
            onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
        >
            {expanded
                ? "Свернуть ↑"
                : `Ещё ${table.rows.length - maxRows} строк ↓`}
        </button>
    );

    // ── карточный вид ─────────────────────────────────────────────────────────

    if (viewMode === "card") {
        return (
            <NodeViewWrapper as="div" className={nodeClass}>
                {head}
                <div className="mws-node__cards">
                    {visibleRows.map(row => (
                        <div key={row.id} className="mws-node__card">
                            {visibleColumns.map(col => (
                                <div key={col.id} className="mws-node__card-row">
                                    <span className="mws-node__card-label">{col.name}</span>
                                    <span className="mws-node__card-value">
                                        {col.type === "select" && typeof row.cells[col.id] === "string"
                                            ? <StatusBadge value={row.cells[col.id] as string} />
                                            : <CellValue value={row.cells[col.id]} type={col.type} />
                                        }
                                    </span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                {expandBtn}
                {foot}
            </NodeViewWrapper>
        );
    }

    // ── compact / full таблица ────────────────────────────────────────────────

    return (
        <NodeViewWrapper as="div" className={nodeClass}>
            {head}
            <div className="mws-node__scroll">
                <table className="mws-node__table">
                    <thead>
                        <tr>
                            {visibleColumns.map(col => (
                                <th key={col.id} className="mws-node__th" style={{ width: col.width }}>
                                    {col.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {visibleRows.map((row, ri) => (
                            <tr key={row.id} className={ri % 2 !== 0 ? "mws-node__tr--odd" : ""}>
                                {visibleColumns.map(col => (
                                    <td key={col.id} className="mws-node__td">
                                        {col.type === "select" && typeof row.cells[col.id] === "string"
                                            ? <StatusBadge value={row.cells[col.id] as string} />
                                            : <CellValue value={row.cells[col.id]} type={col.type} />
                                        }
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {expandBtn}
            {foot}
        </NodeViewWrapper>
    );
}
