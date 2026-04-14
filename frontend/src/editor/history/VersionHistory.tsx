// ─── src/editor/history/VersionHistory.tsx ────────────────────────────────────
// Панель истории версий документа.
// Показывает список снапшотов, позволяет восстановить или удалить.

import { useState } from "react";
import { useHistory, historyStore, type SnapshotEntry } from "./historyStore";
import { ydoc } from "../collab/collabProvider";

interface VersionHistoryProps {
    pageId: string;
    onCreateSnapshot: () => void;
    onClose: () => void;
}

export function VersionHistory({ pageId, onCreateSnapshot, onClose }: VersionHistoryProps) {
    const snapshots = useHistory(pageId);
    const [restoring, setRestoring] = useState<string | null>(null);

    async function handleRestore(snap: SnapshotEntry) {
        if (!confirm(`Восстановить версию "${snap.label}"? Текущие изменения будут перезаписаны.`)) return;
        setRestoring(snap.id);
        try {
            historyStore.restore(pageId, snap.id, ydoc);
        } finally {
            setRestoring(null);
        }
    }

    function handleDelete(snap: SnapshotEntry, e: React.MouseEvent) {
        e.stopPropagation();
        if (!confirm(`Удалить версию "${snap.label}"?`)) return;
        historyStore.delete(pageId, snap.id);
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-default)",
                flexShrink: 0,
            }}>
                <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", color: "var(--text-primary)" }}>
                        История версий
                    </div>
                    <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
                        {snapshots.length} снапшотов
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        onClick={onCreateSnapshot}
                        style={{
                            padding: "4px 10px",
                            background: "var(--accent)",
                            border: "none",
                            borderRadius: "var(--radius-sm)",
                            color: "#fff",
                            fontSize: "var(--fs-xs)",
                            cursor: "pointer",
                        }}
                    >
                        Сохранить версию
                    </button>
                    <button
                        onClick={onClose}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16 }}
                    >✕</button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
                {snapshots.length === 0 && (
                    <div style={{
                        color: "var(--text-tertiary)", fontSize: "var(--fs-sm)",
                        textAlign: "center", padding: "24px 16px",
                    }}>
                        Снапшоты создаются автоматически каждые 5 минут или вручную.
                    </div>
                )}

                {snapshots.map(snap => (
                    <div
                        key={snap.id}
                        style={{
                            display: "flex", alignItems: "flex-start", gap: 10,
                            padding: "10px 16px",
                            borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
                            transition: "background 0.1s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    >
                        <div style={{ fontSize: 20, flexShrink: 0 }}>📷</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontWeight: 500, fontSize: "var(--fs-sm)",
                                color: "var(--text-primary)", wordBreak: "break-word",
                            }}>
                                {snap.label}
                            </div>
                            <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
                                {new Date(snap.createdAt).toLocaleString("ru-RU")}
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button
                                onClick={() => handleRestore(snap)}
                                disabled={restoring === snap.id}
                                title="Восстановить эту версию"
                                style={{
                                    padding: "3px 8px",
                                    background: "none",
                                    border: "1px solid var(--border-default)",
                                    borderRadius: "var(--radius-sm)",
                                    color: "var(--text-secondary)",
                                    fontSize: "var(--fs-xs)",
                                    cursor: "pointer",
                                }}
                            >
                                {restoring === snap.id ? "…" : "Восст."}
                            </button>
                            <button
                                onClick={e => handleDelete(snap, e)}
                                title="Удалить снапшот"
                                style={{
                                    background: "none", border: "none",
                                    cursor: "pointer", color: "var(--text-tertiary)",
                                    fontSize: 14, padding: "3px 4px",
                                }}
                            >🗑️</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
