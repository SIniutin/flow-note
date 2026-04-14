// ─── src/editor/history/VersionHistory.tsx ────────────────────────────────────

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { useHistory, historyStore, type SnapshotEntry } from "./historyStore";
import "./versionHistory.css";

interface VersionHistoryProps {
    pageId:           string;
    editor:           Editor | null;
    onCreateSnapshot: () => void;
    onClose:          () => void;
}

function IconClock() {
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="6.5"/>
            <polyline points="8,4.5 8,8 10.5,10"/>
        </svg>
    );
}
function IconRestore() {
    return (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 8a6 6 0 1 0 1.5-4"/>
            <polyline points="2,4 2,8 6,8"/>
        </svg>
    );
}
function IconTrash() {
    return (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3,5 13,5"/>
            <path d="M5 5V3h6v2"/>
            <path d="M4 5l1 9h6l1-9"/>
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
function IconPlus() {
    return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="8" y1="3" x2="8" y2="13"/>
            <line x1="3" y1="8" x2="13" y2="8"/>
        </svg>
    );
}

export function VersionHistory({ pageId, editor, onCreateSnapshot, onClose }: VersionHistoryProps) {
    const snapshots = useHistory(pageId);
    const [restoring, setRestoring] = useState<string | null>(null);
    const [restoreError, setRestoreError] = useState<string | null>(null);

    function handleRestore(snap: SnapshotEntry) {
        if (!confirm(`Восстановить версию «${snap.label}»?\nТекущие изменения будут перезаписаны.`)) return;
        setRestoring(snap.id);
        setRestoreError(null);
        try {
            if (!snap.contentHtml) {
                setRestoreError(`Снапшот «${snap.label}» создан без HTML-содержимого и не может быть восстановлен.`);
                return;
            }
            if (!editor) {
                setRestoreError("Редактор не готов.");
                return;
            }
            // setContent → ProseMirror transaction → Collaboration extension
            // кодирует изменение обратно в ydoc → Hocuspocus синхронизирует.
            editor.commands.setContent(snap.contentHtml, { emitUpdate: true });
        } finally {
            setRestoring(null);
        }
    }

    function handleDelete(snap: SnapshotEntry, e: React.MouseEvent) {
        e.stopPropagation();
        if (!confirm(`Удалить версию «${snap.label}»?`)) return;
        historyStore.delete(pageId, snap.id);
    }

    function formatDate(iso: string) {
        const d = new Date(iso);
        const today = new Date();
        const isToday = d.toDateString() === today.toDateString();
        return isToday
            ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
            : d.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    }

    return (
        <div className="vh">
            {/* Header */}
            <div className="vh__head">
                <div className="vh__head-top">
                    <div className="vh__head-left">
                        <span className="vh__title">История версий</span>
                        {snapshots.length > 0 && <span className="vh__count">{snapshots.length}</span>}
                    </div>
                    <button className="vh__close-btn" onClick={onClose} title="Закрыть">
                        <IconClose/>
                    </button>
                </div>
                <button className="vh__save-btn" onClick={onCreateSnapshot}>
                    <IconPlus/> Сохранить текущую версию
                </button>
            </div>

            {/* Error */}
            {restoreError && (
                <div className="vh__error" onClick={() => setRestoreError(null)}>
                    {restoreError}
                </div>
            )}

            {/* List */}
            <div className="vh__list">
                {snapshots.length === 0 ? (
                    <div className="vh__empty">
                        <IconClock/>
                        <span>Нет сохранённых версий.</span>
                        <span>Нажмите «Сохранить версию» чтобы создать снапшот.</span>
                    </div>
                ) : (
                    snapshots.map(snap => (
                        <div key={snap.id} className="vh__item">
                            <div className="vh__item-icon">
                                <IconClock/>
                            </div>
                            <div className="vh__item-body">
                                <div className="vh__item-label">{snap.label}</div>
                                <div className="vh__item-date">{formatDate(snap.createdAt)}</div>
                                {!snap.contentHtml && (
                                    <div className="vh__item-warn">Без HTML — восстановление недоступно</div>
                                )}
                            </div>
                            <div className="vh__item-actions">
                                <button
                                    className="vh__action-btn vh__action-btn--restore"
                                    onClick={() => handleRestore(snap)}
                                    disabled={restoring === snap.id || !snap.contentHtml}
                                    title="Восстановить эту версию"
                                >
                                    {restoring === snap.id ? "…" : <><IconRestore/> Восст.</>}
                                </button>
                                <button
                                    className="vh__action-btn vh__action-btn--delete"
                                    onClick={e => handleDelete(snap, e)}
                                    title="Удалить снапшот"
                                >
                                    <IconTrash/>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
