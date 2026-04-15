// ─── src/editor/history/VersionHistory.tsx ────────────────────────────────────

import { useEffect, useState } from "react";
import * as Y from "yjs";
// Yjs 13 экспортирует applyUpdate в runtime, но TypeScript typings отстают.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yApplyUpdate: (doc: Y.Doc, update: Uint8Array) => void = (Y as any).applyUpdate;
type YDoc = Y.Doc;
import { pageClient, type BackendVersion } from "../../api/pageClient";
import { mediaClient } from "../../api/mediaClient";
import { getAccessToken } from "../../data/authStore";
import "./versionHistory.css";

interface VersionHistoryProps {
    pageId:    string;
    onClose:   () => void;
    onPreview: (doc: YDoc, label: string) => void;
}

function IconClock() {
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="6.5"/>
            <polyline points="8,4.5 8,8 10.5,10"/>
        </svg>
    );
}
function IconEye() {
    return (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
            <circle cx="8" cy="8" r="2"/>
        </svg>
    );
}
function IconClose() {
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="3" x2="13" y2="13"/>
            <line x1="13" y1="3" x2="3" y2="13"/>
        </svg>
    );
}

/** Парсим timestamp из S3-ключа: "snapshots/{pageId}/{timestamp}.bin" */
function keyToDate(s3Key: string): Date {
    const part = s3Key.split("/").pop()?.replace(".bin", "") ?? "";
    const ts = parseInt(part, 10);
    return isNaN(ts) ? new Date(0) : new Date(ts);
}

function formatDate(d: Date): string {
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    return isToday
        ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}

export function VersionHistory({ pageId, onClose, onPreview }: VersionHistoryProps) {
    const [versions, setVersions]   = useState<BackendVersion[]>([]);
    const [loading, setLoading]     = useState(true);
    const [loadingId, setLoadingId] = useState<number | null>(null);
    const [error, setError]         = useState<string | null>(null);

    function loadVersions() {
        if (!getAccessToken()) { setLoading(false); return; }
        setLoading(true);
        setError(null);
        pageClient.listVersions(pageId)
            .then(({ versions: v }) => setVersions(v ?? []))
            .catch(() => setError("Не удалось загрузить историю версий"))
            .finally(() => setLoading(false));
    }

    useEffect(() => { loadVersions(); }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

    async function handlePreview(v: BackendVersion) {
        setLoadingId(v.id);
        setError(null);
        try {
            // v.date — полный S3-ключ вида "snapshots/{pageId}/{timestamp}.bin".
            // media-service строит путь как snapshots/{pageId}/{versionId},
            // поэтому передаём только имя файла.
            const filename = v.date.split("/").pop() ?? v.date;
            const presignedUrl = await mediaClient.getSnapshotUrl(v.pageId, filename);
            const res = await fetch(presignedUrl);
            if (!res.ok) throw new Error(`fetch snapshot: ${res.status}`);
            const bytes = new Uint8Array(await res.arrayBuffer());
            const doc = new Y.Doc();
            yApplyUpdate(doc, bytes);
            const date = keyToDate(v.date);
            onPreview(doc, `Версия #${v.id} · ${formatDate(date)}`);
        } catch (err) {
            console.error("[VersionHistory] preview failed:", err);
            setError("Не удалось загрузить версию");
        } finally {
            setLoadingId(null);
        }
    }

    return (
        <div className="vh">
            {/* Header */}
            <div className="vh__head">
                <div className="vh__head-top">
                    <div className="vh__head-left">
                        <span className="vh__title">История версий</span>
                        {versions.length > 0 && <span className="vh__count">{versions.length}</span>}
                    </div>
                    <button className="vh__close-btn" onClick={onClose} title="Закрыть">
                        <IconClose/>
                    </button>
                </div>
                <p className="vh__subtitle">
                    Снимки сохраняются автоматически. Каждая версия — это состояние документа на момент снимка. Нажмите 👁 чтобы просмотреть.
                </p>
            </div>

            {/* Error */}
            {error && (
                <div className="vh__error" onClick={loadVersions} title="Нажмите чтобы повторить">
                    {error} — <u>повторить</u>
                </div>
            )}

            {/* List */}
            <div className="vh__list">
                {loading ? (
                    <div className="vh__empty">
                        <IconClock/>
                        <span>Загрузка…</span>
                    </div>
                ) : versions.length === 0 ? (
                    <div className="vh__empty">
                        <IconClock/>
                        <span>Нет сохранённых версий.</span>
                        <span>Версии создаются автоматически при редактировании.</span>
                    </div>
                ) : (
                    // Новые версии сверху
                    [...versions].reverse().map(v => {
                        const date = keyToDate(v.date);
                        const isLoading = loadingId === v.id;
                        return (
                            <div key={v.id} className="vh__item">
                                <div className="vh__item-icon"><IconClock/></div>
                                <div className="vh__item-body">
                                    <div className="vh__item-label">Версия #{v.id}</div>
                                    <div className="vh__item-date">
                                        {formatDate(date)} · {formatSize(v.size)}
                                    </div>
                                </div>
                                <div className="vh__item-actions">
                                    <button
                                        className="vh__action-btn vh__action-btn--view"
                                        onClick={() => { void handlePreview(v); }}
                                        disabled={isLoading || loadingId !== null}
                                        title="Просмотреть эту версию (только чтение)"
                                    >
                                        {isLoading ? "…" : <><IconEye/> Смотреть</>}
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
