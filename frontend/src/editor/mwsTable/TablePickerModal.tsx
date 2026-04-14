// ─── src/editor/mwsTable/TablePickerModal.tsx ─────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "../../components/ui/surfaces";
import { tablesClient } from "../../api/tablesClient";
import { tablePickerStore, useTablePickerState } from "./tablePickerStore";
import { useBacklinkCounts } from "./backlinksStore";
import type { MwsTable } from "../../types/mwsTable";
import "./tablePickerModal.css";

type TableMeta = Omit<MwsTable, "rows">;
type DisplayMode = "table" | "full" | "cards";

export function TablePickerModal() {
    const { open, editor, range } = useTablePickerState();
    const backlinkCounts = useBacklinkCounts();

    const [query, setQuery] = useState("");
    const [tables, setTables] = useState<TableMeta[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState(0);
    const [display, setDisplay] = useState<DisplayMode>("table");
    const [maxRows, setMaxRows] = useState(5);

    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        setQuery("");
        setSelectedId(null);
        setHoveredIndex(0);
        setDisplay("table");
        setMaxRows(5);
        setLoading(true);
        tablesClient.listTables()
            .then(setTables)
            .finally(() => setLoading(false));
        requestAnimationFrame(() => searchRef.current?.focus());
    }, [open]);

    useEffect(() => {
        if (!open) return;
        if (!query.trim()) {
            tablesClient.listTables().then(setTables);
            return;
        }
        const tid = setTimeout(() => {
            tablesClient.searchTables(query).then(setTables);
        }, 160);
        return () => clearTimeout(tid);
    }, [query, open]);

    useEffect(() => { setHoveredIndex(0); }, [tables]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHoveredIndex(i => Math.min(i + 1, tables.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHoveredIndex(i => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const t = tables[hoveredIndex];
            if (t) setSelectedId(prev => (prev === t.id ? null : t.id));
        }
    }, [tables, hoveredIndex]);

    const handleInsert = useCallback(() => {
        if (!selectedId || !editor || !range) return;
        editor.chain().focus().deleteRange(range).insertMwsTable({
            block_id: null,
            dst_id:   selectedId,
            display,
            maxRows,
        }).run();
        tablePickerStore.reset();
    }, [selectedId, editor, range, display, maxRows]);

    const handleClose = useCallback(() => {
        tablePickerStore.reset();
    }, []);

    const selectedTable = tables.find(t => t.id === selectedId);

    const footer = (
        <div className="tpm-foot">
            <span className="tpm-foot__hint">
                {loading ? "Загрузка…" : `${tables.length} таблиц`}
            </span>
            <div className="tpm-foot__actions">
                <button className="tpm-btn tpm-btn--cancel" onClick={handleClose}>
                    Отмена
                </button>
                <button
                    className="tpm-btn tpm-btn--insert"
                    onClick={handleInsert}
                    disabled={!selectedId}
                >
                    Вставить таблицу
                </button>
            </div>
        </div>
    );

    return (
        <Modal
            open={open}
            onClose={handleClose}
            title="Вставить MWS Table"
            subtitle="Выберите таблицу для встраивания в документ"
            width={440}
            footer={footer}
        >
            <div className="tpm-body">
                <div className="tpm-search" onKeyDown={handleKeyDown}>
                    <span className="tpm-search__icon">🔍</span>
                    <input
                        ref={searchRef}
                        className="tpm-search__input"
                        placeholder="Поиск таблиц…"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>

                <ul className="tpm-list" onKeyDown={handleKeyDown}>
                    {loading ? (
                        <li className="tpm-list__empty">Загрузка…</li>
                    ) : tables.length === 0 ? (
                        <li className="tpm-list__empty">Ничего не найдено</li>
                    ) : (
                        tables.map((t, i) => (
                            <TableItem
                                key={t.id}
                                table={t}
                                hovered={i === hoveredIndex}
                                selected={selectedId === t.id}
                                backlinkCount={backlinkCounts.get(t.id) ?? 0}
                                onHover={() => setHoveredIndex(i)}
                                onToggle={() => setSelectedId(prev => (prev === t.id ? null : t.id))}
                            />
                        ))
                    )}
                </ul>

                {selectedTable && (
                    <div className="tpm-opts">
                        <div className="tpm-opts__label">
                            Настройки для «{selectedTable.name}»
                        </div>
                        <div className="tpm-opts__row">
                            <span className="tpm-opts__key">Вид</span>
                            <div className="tpm-seg">
                                {(["table", "full", "cards"] as const).map(m => (
                                    <button
                                        key={m}
                                        className={`tpm-seg__btn${display === m ? " is-active" : ""}`}
                                        onClick={() => setDisplay(m)}
                                    >
                                        {m === "table" ? "Compact" : m === "full" ? "Full" : "Cards"}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="tpm-opts__row">
                            <span className="tpm-opts__key">Макс. строк</span>
                            <input
                                type="number"
                                className="tpm-number"
                                min={1}
                                max={50}
                                value={maxRows}
                                onChange={e => setMaxRows(Number(e.target.value))}
                            />
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}

function TableItem({
    table, hovered, selected, backlinkCount, onHover, onToggle,
}: {
    table: TableMeta;
    hovered: boolean;
    selected: boolean;
    backlinkCount: number;
    onHover: () => void;
    onToggle: () => void;
}) {
    const cls = [
        "tpm-item",
        hovered ? "is-hovered" : "",
        selected ? "is-selected" : "",
    ].filter(Boolean).join(" ");

    return (
        <li>
            <button
                className={cls}
                onMouseEnter={onHover}
                onMouseDown={e => { e.preventDefault(); onToggle(); }}
            >
                <span className="tpm-item__icon">{table.icon ?? "📋"}</span>
                <span className="tpm-item__text">
                    <span className="tpm-item__name">{table.name}</span>
                    {table.description && (
                        <span className="tpm-item__desc">{table.description}</span>
                    )}
                </span>
                <span className="tpm-item__meta">{table.columns.length} кол.</span>
                {backlinkCount > 0 && (
                    <span className="tpm-item__links" title={`Используется в ${backlinkCount} документах`}>
                        📎 {backlinkCount}
                    </span>
                )}
                {selected && <span className="tpm-item__check">✓</span>}
            </button>
        </li>
    );
}
