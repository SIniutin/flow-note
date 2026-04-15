// ─── src/editor/mwsTable/TablePickerModal.tsx ─────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "../../components/ui/surfaces";
import { tablesClient } from "../../api/tablesClient";
import { tablePickerStore, useTablePickerState } from "./tablePickerStore";
import { useBacklinkCounts } from "./backlinksStore";
import type { MwsTable, MwsColumn, MwsColumnType } from "../../types/mwsTable";
import "./tablePickerModal.css";

type TableMeta = Omit<MwsTable, "rows">;
type DisplayMode = "table" | "full" | "cards";
type PickerMode = "pick" | "create";

const COLUMN_TYPES: { value: MwsColumnType; label: string }[] = [
    { value: "text",    label: "Текст"   },
    { value: "number",  label: "Число"   },
    { value: "select",  label: "Выбор"   },
    { value: "boolean", label: "Да/Нет"  },
    { value: "date",    label: "Дата"    },
    { value: "url",     label: "Ссылка"  },
];

export function TablePickerModal() {
    const { open, editor, range } = useTablePickerState();
    const backlinkCounts = useBacklinkCounts();

    const [pickerMode, setPickerMode] = useState<PickerMode>("pick");
    const [query, setQuery] = useState("");
    const [tables, setTables] = useState<TableMeta[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState(0);
    const [display, setDisplay] = useState<DisplayMode>("table");
    const [maxRows, setMaxRows] = useState(5);

    // create mode state
    const [newName, setNewName] = useState("");
    const [newIcon, setNewIcon] = useState("📋");
    const [newColumns, setNewColumns] = useState<Array<{ name: string; type: MwsColumnType }>>([
        { name: "Название", type: "text" },
    ]);
    const [creating, setCreating] = useState(false);

    const searchRef = useRef<HTMLInputElement>(null);
    const nameRef   = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        setPickerMode("pick");
        setQuery("");
        setSelectedId(null);
        setHoveredIndex(0);
        setDisplay("table");
        setMaxRows(5);
        setNewName("");
        setNewIcon("📋");
        setNewColumns([{ name: "Название", type: "text" }]);
        setLoading(true);
        tablesClient.listTables()
            .then(setTables)
            .finally(() => setLoading(false));
        requestAnimationFrame(() => searchRef.current?.focus());
    }, [open]);

    useEffect(() => {
        if (pickerMode === "create") {
            requestAnimationFrame(() => nameRef.current?.focus());
        }
    }, [pickerMode]);

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

    const handleCreate = useCallback(async () => {
        if (!newName.trim() || !editor || !range || creating) return;
        setCreating(true);
        try {
            const cols: MwsColumn[] = newColumns
                .filter(c => c.name.trim())
                .map((c, i) => ({ id: `col_${i}`, name: c.name.trim(), type: c.type, width: 160 }));
            if (cols.length === 0) cols.push({ id: "col_0", name: "Название", type: "text", width: 160 });
            const table = await tablesClient.createTable(newName.trim(), newIcon, cols);
            editor.chain().focus().deleteRange(range).insertMwsTable({
                block_id: null,
                dst_id:   table.id,
                display:  "table",
                maxRows:  5,
            }).run();
            tablePickerStore.reset();
        } finally {
            setCreating(false);
        }
    }, [newName, newIcon, newColumns, editor, range, creating]);

    const addColumn = useCallback(() => {
        setNewColumns(c => [...c, { name: "", type: "text" }]);
    }, []);

    const removeColumn = useCallback((i: number) => {
        setNewColumns(c => c.filter((_, j) => j !== i));
    }, []);

    const updateColumn = useCallback((i: number, patch: Partial<{ name: string; type: MwsColumnType }>) => {
        setNewColumns(c => c.map((col, j) => j === i ? { ...col, ...patch } : col));
    }, []);

    const selectedTable = tables.find(t => t.id === selectedId);

    const footer = pickerMode === "pick" ? (
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
                    Вставить
                </button>
            </div>
        </div>
    ) : (
        <div className="tpm-foot">
            <span className="tpm-foot__hint">Новая таблица</span>
            <div className="tpm-foot__actions">
                <button className="tpm-btn tpm-btn--cancel" onClick={handleClose}>
                    Отмена
                </button>
                <button
                    className="tpm-btn tpm-btn--insert"
                    onClick={handleCreate}
                    disabled={!newName.trim() || creating}
                >
                    {creating ? "Создание…" : "Создать и вставить"}
                </button>
            </div>
        </div>
    );

    return (
        <Modal
            open={open}
            onClose={handleClose}
            title="MWS Table"
            subtitle={pickerMode === "pick" ? "Выберите таблицу для встраивания" : "Создайте новую таблицу"}
            width={460}
            footer={footer}
        >
            <div className="tpm-body">
                {/* ── Mode tabs ─────────────────────────────────────────── */}
                <div className="tpm-tabs">
                    <button
                        className={`tpm-tab${pickerMode === "pick" ? " is-active" : ""}`}
                        onClick={() => setPickerMode("pick")}
                    >
                        Выбрать
                    </button>
                    <button
                        className={`tpm-tab${pickerMode === "create" ? " is-active" : ""}`}
                        onClick={() => setPickerMode("create")}
                    >
                        + Создать
                    </button>
                </div>

                {pickerMode === "pick" ? (
                    <>
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
                    </>
                ) : (
                    <div className="tpm-create">
                        <div className="tpm-create__row">
                            <input
                                className="tpm-create__icon-input"
                                value={newIcon}
                                onChange={e => setNewIcon(e.target.value)}
                                maxLength={2}
                                title="Иконка (эмодзи)"
                            />
                            <input
                                ref={nameRef}
                                className="tpm-create__name-input"
                                placeholder="Название таблицы"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter" && newName.trim()) handleCreate(); }}
                                autoComplete="off"
                            />
                        </div>

                        <div className="tpm-create__cols-label">Колонки</div>
                        <div className="tpm-create__cols">
                            {newColumns.map((col, i) => (
                                <div key={i} className="tpm-create__col-row">
                                    <input
                                        className="tpm-create__col-name"
                                        placeholder={`Колонка ${i + 1}`}
                                        value={col.name}
                                        onChange={e => updateColumn(i, { name: e.target.value })}
                                    />
                                    <select
                                        className="tpm-create__col-type"
                                        value={col.type}
                                        onChange={e => updateColumn(i, { type: e.target.value as MwsColumnType })}
                                    >
                                        {COLUMN_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                    {newColumns.length > 1 && (
                                        <button
                                            className="tpm-create__col-remove"
                                            onClick={() => removeColumn(i)}
                                            title="Удалить колонку"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button className="tpm-create__add-col" onClick={addColumn}>
                                + Добавить колонку
                            </button>
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
