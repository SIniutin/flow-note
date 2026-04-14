// ─── src/components/PageMenu.tsx ─────────────────────────────────────────────
// 3-точечное меню страницы: переименовать, права доступа, удалить.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { pagesClient } from "../api/pagesClient";
import { Modal } from "./ui/surfaces";
import { PAGE_PERMISSION_ROLES, PAGE_PERMISSION_ROLE_LABELS } from "../types/pages";
import type { PagePermission, PagePermissionRole } from "../types/pages";
import "./pageMenu.css";

// ── UUID guard ────────────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (s: string) => UUID_RE.test(s);

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconDots() {
    return (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="3.5" cy="8" r="1.3"/>
            <circle cx="8"   cy="8" r="1.3"/>
            <circle cx="12.5" cy="8" r="1.3"/>
        </svg>
    );
}
function IconPencil() {
    return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11.5 2.5a1.5 1.5 0 0 1 2 2L5 13H3v-2L11.5 2.5z"/>
        </svg>
    );
}
function IconUsers() {
    return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="5" r="2.5"/>
            <path d="M1 14c0-3 2-4.5 5-4.5s5 1.5 5 4.5"/>
            <path d="M11 3.5a2.5 2.5 0 0 1 0 5"/>
            <path d="M13.5 14c0-2-1-3.5-2.5-4"/>
        </svg>
    );
}
function IconTrash() {
    return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3,5 13,5"/>
            <path d="M5 5V3h6v2"/>
            <path d="M4 5l1 9h6l1-9"/>
        </svg>
    );
}
function IconClose() {
    return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="3" x2="13" y2="13"/>
            <line x1="13" y1="3" x2="3" y2="13"/>
        </svg>
    );
}

// ── Permissions Modal ─────────────────────────────────────────────────────────

function PermissionsModal({ pageId, onClose }: { pageId: string; onClose: () => void }) {
    const [perms, setPerms]         = useState<PagePermission[]>([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState<string | null>(null);
    const [newUserId, setNewUserId] = useState("");
    const [newRole, setNewRole]     = useState<PagePermissionRole>("viewer");
    const [adding, setAdding]       = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const load = () => {
        if (!isUUID(pageId)) {
            setError("Права доступа доступны только для сохранённых страниц");
            setLoading(false);
            return;
        }
        setLoading(true);
        pagesClient.listPermissions(pageId)
            .then(setPerms)
            .catch(() => setError("Не удалось загрузить права"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [pageId]);

    // Автофокус на поле ввода
    useEffect(() => {
        const t = setTimeout(() => inputRef.current?.focus(), 60);
        return () => clearTimeout(t);
    }, []);

    const handleGrant = async () => {
        if (!newUserId.trim()) return;
        setAdding(true);
        try {
            await pagesClient.grantPermission(pageId, newUserId.trim(), newRole);
            setNewUserId("");
            load();
        } catch {
            setError("Ошибка при добавлении пользователя");
        } finally { setAdding(false); }
    };

    const handleRoleChange = async (userId: string, role: PagePermissionRole) => {
        try { await pagesClient.updatePermission(pageId, userId, role); load(); }
        catch { setError("Не удалось изменить роль"); }
    };

    const handleRevoke = async (userId: string) => {
        try { await pagesClient.revokePermission(pageId, userId); load(); }
        catch { setError("Не удалось отозвать доступ"); }
    };

    return createPortal(
        <Modal open onClose={onClose} title="Доступ к странице" width={400}>
            {error && <div className="perm-modal__error">{error}</div>}

            {/* Добавить пользователя */}
            <div className="perm-modal__add">
                <input
                    ref={inputRef}
                    className="perm-modal__input"
                    placeholder="ID пользователя…"
                    value={newUserId}
                    onChange={e => setNewUserId(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleGrant(); }}
                />
                <select
                    className="perm-modal__select"
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as PagePermissionRole)}
                >
                    {PAGE_PERMISSION_ROLES.filter(r => r !== "owner").map(r => (
                        <option key={r} value={r}>{PAGE_PERMISSION_ROLE_LABELS[r]}</option>
                    ))}
                </select>
                <button
                    className="perm-modal__invite-btn"
                    disabled={!newUserId.trim() || adding}
                    onClick={handleGrant}
                >
                    {adding ? "…" : "Добавить"}
                </button>
            </div>

            {/* Список участников */}
            <div className="perm-modal__list">
                {loading && <div className="perm-modal__hint">Загрузка…</div>}
                {!loading && perms.length === 0 && !error && (
                    <div className="perm-modal__hint">Нет других участников</div>
                )}
                {perms.map(p => (
                    <div key={p.user_id} className="perm-modal__row">
                        <div className="perm-modal__avatar">
                            {p.user_id.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="perm-modal__user">
                            <span className="perm-modal__uid">{p.user_id}</span>
                        </div>
                        <select
                            className="perm-modal__select perm-modal__select--inline"
                            value={p.role}
                            onChange={e => handleRoleChange(p.user_id, e.target.value as PagePermissionRole)}
                            disabled={p.role === "owner"}
                        >
                            {PAGE_PERMISSION_ROLES.map(r => (
                                <option key={r} value={r}>{PAGE_PERMISSION_ROLE_LABELS[r]}</option>
                            ))}
                        </select>
                        {p.role !== "owner" && (
                            <button
                                className="perm-modal__revoke"
                                title="Отозвать доступ"
                                onClick={() => handleRevoke(p.user_id)}
                            >
                                <IconClose/>
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </Modal>,
        document.body,
    );
}

// ── Dropdown Menu ─────────────────────────────────────────────────────────────

interface PageMenuProps {
    pageId:    string;
    canDelete: boolean;
    onRename:  () => void;
    onDelete:  () => void;
}

export function PageMenu({ pageId, canDelete, onRename, onDelete }: PageMenuProps) {
    const [dropOpen, setDropOpen] = useState(false);
    const [permOpen, setPermOpen] = useState(false);
    const [dropPos, setDropPos]   = useState({ top: 0, left: 0 });
    const dropRef = useRef<HTMLDivElement>(null);
    const btnRef  = useRef<HTMLButtonElement>(null);

    // Позиционируем дропдаун по координатам кнопки-триггера
    const openDrop = () => {
        if (btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setDropPos({ top: r.bottom + 4, left: r.right });
        }
        setDropOpen(true);
        setPermOpen(false);
    };

    // Закрытие по клику снаружи
    useEffect(() => {
        if (!dropOpen) return;
        const onDown = (e: MouseEvent) => {
            if (!dropRef.current?.contains(e.target as Node) &&
                !btnRef.current?.contains(e.target as Node))
                setDropOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [dropOpen]);

    const closeAll = () => { setDropOpen(false); setPermOpen(false); };

    return (
        <div className="page-menu" onClick={e => e.stopPropagation()}>
            {/* Trigger */}
            <button
                ref={btnRef}
                className={`page-menu__trigger${dropOpen ? " is-open" : ""}`}
                title="Действия со страницей"
                onClick={() => dropOpen ? setDropOpen(false) : openDrop()}
            >
                <IconDots/>
            </button>

            {/* Dropdown — через портал, чтобы не наследовать opacity родителя */}
            {dropOpen && createPortal(
                <div
                    ref={dropRef}
                    className="page-menu__drop"
                    style={{ position: "fixed", top: dropPos.top, left: dropPos.left, transform: "translateX(-100%)" }}
                >
                    <button className="page-menu__item" onClick={() => { closeAll(); onRename(); }}>
                        <IconPencil/> Переименовать
                    </button>
                    <button className="page-menu__item" onClick={() => { setDropOpen(false); setPermOpen(true); }}>
                        <IconUsers/> Доступ и права
                    </button>
                    <div className="page-menu__divider"/>
                    <button
                        className="page-menu__item page-menu__item--danger"
                        disabled={!canDelete}
                        onClick={() => { closeAll(); onDelete(); }}
                    >
                        <IconTrash/> Удалить
                    </button>
                </div>,
                document.body,
            )}

            {/* Permissions — полноэкранный модал с оверлеем */}
            {permOpen && (
                <PermissionsModal
                    pageId={pageId}
                    onClose={() => setPermOpen(false)}
                />
            )}
        </div>
    );
}
