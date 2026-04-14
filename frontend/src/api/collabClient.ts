// ─── src/api/collabClient.ts ───────────────────────────────────────────────────
// REST client for collab-service table endpoints (collab.proto v1).
// These endpoints return rows from collab-service's in-memory tableRegistry,
// which holds the latest optimistic state before MWS persistence.
//
// Endpoints (via gateway):
//   GET /api/v1/tables/{dst_id}                  → GetTableResponse
//   GET /api/v1/tables/{dst_id}/views             → ListTableViewsResponse
//   GET /api/v1/tables/{dst_id}/views/{view_id}   → GetTableViewResponse

import { getAccessToken } from "../data/authStore";
import type { MwsRow } from "../types/mwsTable";

function authHeaders(): Record<string, string> {
    const token = getAccessToken();
    return token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" };
}

// ── Proto-mapped response types ───────────────────────────────────────────────

interface CollabTableRow {
    record_id: string;
    cells: Record<string, unknown>;
}

interface GetTableResponse {
    dst_id:  string;
    view_id: string;
    rows:    CollabTableRow[];
}

// ── Row mapping ───────────────────────────────────────────────────────────────

function collabRowsToMws(rows: CollabTableRow[]): MwsRow[] {
    return rows.map(r => ({
        id:    r.record_id,
        cells: r.cells as Record<string, string | number | boolean | null>,
    }));
}

// ── public API ────────────────────────────────────────────────────────────────

export const collabClient = {
    /**
     * Fetch rows from collab-service in-memory cache.
     * Returns null when the table is not found (404).
     * Throws on network / server errors.
     */
    async getTableRows(dstId: string): Promise<MwsRow[] | null> {
        const res = await fetch(`/api/v1/tables/${dstId}`, {
            headers: authHeaders(),
        });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`[collabClient] ${res.status} for ${dstId}`);
        const json: GetTableResponse = await res.json();
        return collabRowsToMws(json.rows ?? []);
    },
} as const;
