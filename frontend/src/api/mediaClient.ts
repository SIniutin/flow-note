// ─── src/api/mediaClient.ts ───────────────────────────────────────────────────
// REST client for MediaService (media.proto v1).
// Presigned URLs:
//   POST /v1/media/{page_id}/upload                     → upload URL + media_id
//   GET  /v1/{page_id}/media/{media_id}/download        → download URL
//   GET  /v1/media/snapshots/{page_id}/latest/download  → latest snapshot URL
//   GET  /v1/media/snapshots/{page_id}/{version_id}/download → versioned snapshot

import { getAccessToken } from "../data/authStore";

function authHeaders(): Record<string, string> {
    const token = getAccessToken();
    return token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidPageId(pageId: string): boolean {
    return UUID_RE.test(pageId);
}

// ── Response types (proto-mapped) ─────────────────────────────────────────────

interface UploadUrlResponse {
    upload_url: string;
    media_id:   string;
    expires_at: number;
}

interface DownloadUrlResponse {
    download_url: string;
    expires_at:   number;
}

// ── public API ────────────────────────────────────────────────────────────────

export const mediaClient = {
    /**
     * Get a presigned S3 upload URL for a page.
     * pageId must be a valid UUID.
     */
    async getUploadUrl(pageId: string): Promise<UploadUrlResponse> {
        const res = await fetch(`/v1/media/${pageId}/upload`, {
            method:  "POST",
            headers: authHeaders(),
            body:    "{}",
        });
        if (!res.ok) throw new Error(`[mediaClient] getUploadUrl ${res.status}`);
        return res.json() as Promise<UploadUrlResponse>;
    },

    /**
     * PUT the file directly to the presigned S3 URL.
     * No auth headers — S3 uses the signed URL itself.
     */
    async uploadToUrl(uploadUrl: string, file: File): Promise<void> {
        const res = await fetch(uploadUrl, {
            method:  "PUT",
            headers: { "Content-Type": file.type },
            body:    file,
        });
        if (!res.ok) throw new Error(`[mediaClient] S3 PUT ${res.status}`);
    },

    /**
     * Get a fresh presigned S3 download URL for a media_id.
     * Call this each time you need to display the image (URLs expire).
     */
    async getDownloadUrl(pageId: string, mediaId: string): Promise<string> {
        const res = await fetch(`/v1/${pageId}/media/${mediaId}/download`, {
            headers: authHeaders(),
        });
        if (!res.ok) throw new Error(`[mediaClient] getDownloadUrl ${res.status}`);
        const json: DownloadUrlResponse = await res.json();
        return json.download_url;
    },

    /**
     * Convenience: upload file to S3, return media_id.
     * pageId must be a valid UUID.
     */
    async uploadFile(pageId: string, file: File): Promise<string> {
        const { upload_url, media_id } = await mediaClient.getUploadUrl(pageId);
        await mediaClient.uploadToUrl(upload_url, file);
        return media_id;
    },

    /**
     * Get presigned download URL for the latest page snapshot.
     */
    async getLatestSnapshotUrl(pageId: string): Promise<string> {
        const res = await fetch(`/v1/media/snapshots/${pageId}/latest/download`, {
            headers: authHeaders(),
        });
        if (!res.ok) throw new Error(`[mediaClient] getLatestSnapshot ${res.status}`);
        const json: DownloadUrlResponse = await res.json();
        return json.download_url;
    },

    /**
     * Get presigned download URL for a specific page snapshot version.
     */
    async getSnapshotUrl(pageId: string, versionId: string): Promise<string> {
        const res = await fetch(`/v1/media/snapshots/${pageId}/${versionId}/download`, {
            headers: authHeaders(),
        });
        if (!res.ok) throw new Error(`[mediaClient] getSnapshot ${res.status}`);
        const json: DownloadUrlResponse = await res.json();
        return json.download_url;
    },
} as const;
