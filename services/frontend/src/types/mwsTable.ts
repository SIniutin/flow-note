// ─── src/types/mwsTable.ts ─────────────────────────────────────────────────────
// Типы согласованы со схемой wikilive_editor_contract v1.

export type MwsColumnType =
    | "text"
    | "number"
    | "date"
    | "boolean"
    | "select"
    | "url";

export interface MwsColumn {
    id: string;
    name: string;
    type: MwsColumnType;
    width?: number;
}

export interface MwsRow {
    id: string;
    cells: Record<string, string | number | boolean | null>;
}

export interface MwsTable {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    columns: MwsColumn[];
    rows: MwsRow[];
    createdAt: string;
    updatedAt: string;
}

/**
 * Атрибуты узла mwsTable по схеме wikilive_editor_contract.
 * dst_id соответствует MwsTable.id в tablesClient.
 */
export interface MwsTableNodeAttrs {
    block_id:  string | null;
    dst_id:    string | null;       // id таблицы (was: tableId)
    view_id?:  string | null;
    title?:    string | null;       // display title (was: caption)
    display?:  "table" | "full" | "cards";  // render mode (was: viewMode)
    maxRows?:  number;              // legacy
    // Legacy aliases — kept for backward compat with old saved docs
    viewMode?: "compact" | "full" | "card";
    tableId?:  string | null;
}
