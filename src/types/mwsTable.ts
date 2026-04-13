// ─── src/types/mwsTable.ts ─────────────────────────────────────────────────────

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

/** Атрибуты, хранящиеся в atom-узле TipTap */
export interface MwsTableNodeAttrs {
    tableId: string;
    viewMode: "compact" | "full" | "card";
    pinnedColumns?: string[];
    maxRows?: number;
    caption?: string;
}
