// ─── src/editor/mwsTable/MwsTableNodeView.tsx ────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { tablesClient } from "../../api/tablesClient";
import { BacklinksChip } from "./BacklinksChip";
import type { MwsTable, MwsColumnType } from "../../types/mwsTable";
import { provider } from "../collab/collabProvider";
import "./mwsTableNodeView.css";

// ── helpers ───────────────────────────────────────────────────────────────────

const MODE_LABELS: Record<"compact"|"full"|"card", string> = {
    compact: "Compact",
    full: "Full",
    card: "Cards",
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
    const attrs = node.attrs;
    const { dst_id: tableId, display, title: caption, maxRows = 5 } = attrs;
    const viewMode: "compact" | "full" | "card" =
        display === "cards" ? "card" : display === "full" ? "full" : "compact";

    const [table, setTable] = useState<MwsTable | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [colsExpanded, setColsExpanded] = useState(false);
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

    // ── live-sync: stateless-сообщения от collab-service ─────────────────────
    // tbl_op      — optimistic update (collab-service уже обновил свой кэш)
    // tbl_rollback — откат optimistic update
    // tbl_aw      — acknowledged write (MWS подтвердил запись)
    //
    // Во всех случаях инвалидируем TTL-кэш и перечитываем из collab-service
    // (tablesClient.getTable теперь читает из collab-service первым).
    // Это устраняет race: UI всегда видит то же состояние, что collab-service.

    useEffect(() => {
        if (!tableId) return;
        const handler = ({ payload }: { payload: string }) => {
            try {
                const msg = JSON.parse(payload) as { type?: string; dst_id?: string };
                const relevant =
                    msg.dst_id === tableId &&
                    (msg.type === "tbl_op" || msg.type === "tbl_rollback" || msg.type === "tbl_aw");
                if (relevant) {
                    tablesClient.invalidateCache(tableId);
                    tablesClient.getTable(tableId)
                        .then(t => { if (t) setTable(t); })
                        .catch(() => { /* ignore */ });
                }
            } catch { /* ignore invalid JSON */ }
        };
        provider.on("stateless", handler);
        return () => { provider.off("stateless", handler); };
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

    const handleModeChange = useCallback((mode: "compact" | "full" | "card") => {
        const display = mode === "card" ? "cards" : mode === "full" ? "full" : "table";
        updateAttributes({ display });
        setColsExpanded(false);
        setModeMenuOpen(false);
    }, [updateAttributes]);

    // ── производные ───────────────────────────────────────────────────────────

    const visibleRows = table
        ? (expanded ? table.rows : table.rows.slice(0, maxRows))
        : [];

    const allColumns = table?.columns ?? [];
    const COMPACT_COLS = 3;
    const visibleColumns = (viewMode === "compact" && !colsExpanded)
        ? allColumns.slice(0, COMPACT_COLS)
        : allColumns;
    const hiddenColCount = (viewMode === "compact" && !colsExpanded)
        ? Math.max(0, allColumns.length - COMPACT_COLS)
        : 0;

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
                        {(Object.keys(MODE_LABELS) as ("compact"|"full"|"card")[]).map(m => (
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
            <BacklinksChip tableId={tableId ?? ""} />
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
                            {hiddenColCount > 0 && (
                                <th className="mws-node__th mws-node__th--more">
                                    <button
                                        className="mws-node__cols-expand"
                                        onClick={e => { e.stopPropagation(); setColsExpanded(true); }}
                                        title="Показать все колонки"
                                    >
                                        +{hiddenColCount}
                                    </button>
                                </th>
                            )}
                            {colsExpanded && viewMode === "compact" && (
                                <th className="mws-node__th mws-node__th--more">
                                    <button
                                        className="mws-node__cols-expand"
                                        onClick={e => { e.stopPropagation(); setColsExpanded(false); }}
                                        title="Свернуть"
                                    >
                                        ←
                                    </button>
                                </th>
                            )}
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
                                {hiddenColCount > 0 && <td className="mws-node__td mws-node__td--more" />}
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
