// ─── src/components/PageMenu.tsx ─────────────────────────────────────────────
// 3-точечное меню страницы: переименовать, права доступа, удалить.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { pagesClient } from "../api/pagesClient";
import { authClient, type AuthUser } from "../api/authClient";
import { getAccessToken } from "../data/authStore";
import { Modal } from "./ui/surfaces";
import { PAGE_PERMISSION_ROLES, PAGE_PERMISSION_ROLE_LABELS } from "../types/pages";
import type { PagePermission, PagePermissionRole } from "../types/pages";
import "./pageMenu.css";

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

interface MemberInfo {
    perm: PagePermission;
    user: AuthUser | null;
}

function PermissionsModal({ pageId, onClose }: { pageId: string; onClose: () => void }) {
    const [members, setMembers]       = useState<MemberInfo[]>([]);
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState<string | null>(null);

    // Поиск пользователя по логину
    const [login, setLogin]           = useState("");
    const [foundUser, setFoundUser]   = useState<AuthUser | null>(null);
    const [searching, setSearching]   = useState(false);
    const [searchErr, setSearchErr]   = useState<string | null>(null);
    const [newRole, setNewRole]       = useState<PagePermissionRole>("viewer");
    const [adding, setAdding]         = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const load = () => {
        setLoading(true);
        pagesClient.listPermissions(pageId)
            .then(async perms => {
                const token = getAccessToken() ?? undefined;
                const rows = await Promise.all(
                    perms.map(async (p): Promise<MemberInfo> => {
                        try {
                            const { user } = await authClient.getById(p.user_id, token);
                            return { perm: p, user };
                        } catch {
                            return { perm: p, user: null };
                        }
                    })
                );
                setMembers(rows);
            })
            .catch(() => setError("Не удалось загрузить права"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const t = setTimeout(() => inputRef.current?.focus(), 60);
        return () => clearTimeout(t);
    }, []);

    const handleSearch = async () => {
        if (!login.trim()) return;
        setSearching(true);
        setSearchErr(null);
        setFoundUser(null);
        try {
            const token = getAccessToken() ?? undefined;
            const { user } = await authClient.getByName(login.trim(), token);
            setFoundUser(user);
        } catch {
            setSearchErr("Пользователь не найден");
        } finally {
            setSearching(false);
        }
    };

    const handleGrant = async () => {
        if (!foundUser) return;
        setAdding(true);
        setError(null);
        try {
            await pagesClient.grantPermission(pageId, foundUser.id, newRole);
            setFoundUser(null);
            setLogin("");
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
        <Modal open onClose={onClose} title="Доступ к странице" width={420}>
            {error && <div className="perm-modal__error" onClick={() => setError(null)}>{error}</div>}

            {/* Поиск пользователя по логину */}
            <div className="perm-modal__add">
                <div className="perm-modal__search-row">
                    <input
                        ref={inputRef}
                        className="perm-modal__input"
                        placeholder="Логин пользователя…"
                        value={login}
                        onChange={e => { setLogin(e.target.value); setFoundUser(null); setSearchErr(null); }}
                        onKeyDown={e => { if (e.key === "Enter") void handleSearch(); }}
                    />
                    <button
                        className="perm-modal__search-btn"
                        disabled={searching || !login.trim()}
                        onClick={() => void handleSearch()}
                    >
                        {searching ? "…" : "Найти"}
                    </button>
                </div>

                {searchErr && <div className="perm-modal__search-err">{searchErr}</div>}

                {foundUser && (
                    <div className="perm-modal__found">
                        <div className="perm-modal__found-info">
                            <span className="perm-modal__found-name">{foundUser.login}</span>
                            <span className="perm-modal__found-email">{foundUser.email}</span>
                        </div>
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
                            disabled={adding}
                            onClick={() => void handleGrant()}
                        >
                            {adding ? "…" : "Добавить"}
                        </button>
                    </div>
                )}
            </div>

            {/* Список участников */}
            <div className="perm-modal__list">
                {loading && <div className="perm-modal__hint">Загрузка…</div>}
                {!loading && members.length === 0 && !error && (
                    <div className="perm-modal__hint">Нет других участников</div>
                )}
                {members.map(({ perm: p, user }) => (
                    <div key={p.user_id} className="perm-modal__row">
                        <div className="perm-modal__avatar">
                            {(user?.login ?? p.user_id).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="perm-modal__user">
                            <span className="perm-modal__uid">{user?.login ?? p.user_id}</span>
                            {user?.email && <span className="perm-modal__email">{user.email}</span>}
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
                                onClick={() => void handleRevoke(p.user_id)}
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
