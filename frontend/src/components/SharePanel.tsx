// ─── src/components/SharePanel.tsx ───────────────────────────────────────────
// Панель управления доступом к странице: список участников, grant, revoke.

import { useEffect, useState } from "react";
import { pageClient, type PagePermission, type PermissionRole, ROLE_LABELS } from "../api/pageClient";
import { authClient, type AuthUser } from "../api/authClient";
import { getAccessToken } from "../data/authStore";
import "./sharePanel.css";

interface SharePanelProps {
    pageId:  string;
    onClose: () => void;
}

interface MemberRow {
    permission: PagePermission;
    user:       AuthUser | null;
}

const GRANTABLE_ROLES: { value: PermissionRole; label: string }[] = [
    { value: "PAGE_PERMISSION_ROLE_VIEWER",    label: "Просмотр" },
    { value: "PAGE_PERMISSION_ROLE_COMMENTER", label: "Комментирование" },
    { value: "PAGE_PERMISSION_ROLE_EDITOR",    label: "Редактирование" },
    { value: "PAGE_PERMISSION_ROLE_MENTOR",    label: "Управление доступом" },
];

function IconClose() {
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="3" x2="13" y2="13"/>
            <line x1="13" y1="3" x2="3" y2="13"/>
        </svg>
    );
}
function IconTrash() {
    return (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2,4 14,4"/>
            <path d="M5 4V2h6v2"/>
            <rect x="3" y="4" width="10" height="10" rx="1"/>
            <line x1="6" y1="7" x2="6" y2="11"/>
            <line x1="10" y1="7" x2="10" y2="11"/>
        </svg>
    );
}

export function SharePanel({ pageId, onClose }: SharePanelProps) {
    const [members, setMembers]       = useState<MemberRow[]>([]);
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState<string | null>(null);

    // Форма добавления
    const [login, setLogin]           = useState("");
    const [role, setRole]             = useState<PermissionRole>("PAGE_PERMISSION_ROLE_EDITOR");
    const [foundUser, setFoundUser]   = useState<AuthUser | null>(null);
    const [searching, setSearching]   = useState(false);
    const [searchErr, setSearchErr]   = useState<string | null>(null);
    const [granting, setGranting]     = useState(false);
    const [revokingId, setRevokingId] = useState<string | null>(null);

    function loadMembers() {
        if (!getAccessToken()) { setLoading(false); return; }
        setLoading(true);
        setError(null);
        pageClient.listPermissions(pageId)
            .then(async ({ permissions }) => {
                const token = getAccessToken() ?? undefined;
                const rows = await Promise.all(
                    permissions.map(async (p): Promise<MemberRow> => {
                        try {
                            const { user } = await authClient.getById(p.userId, token);
                            return { permission: p, user };
                        } catch {
                            return { permission: p, user: null };
                        }
                    })
                );
                setMembers(rows);
            })
            .catch(() => setError("Не удалось загрузить список участников"))
            .finally(() => setLoading(false));
    }

    useEffect(() => { loadMembers(); }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

    async function handleSearch() {
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
    }

    async function handleGrant() {
        if (!foundUser) return;
        setGranting(true);
        setError(null);
        try {
            await pageClient.grantPermission(pageId, foundUser.id, role);
            setFoundUser(null);
            setLogin("");
            loadMembers();
        } catch (e) {
            setError((e as Error).message || "Не удалось выдать доступ");
        } finally {
            setGranting(false);
        }
    }

    async function handleRevoke(userId: string) {
        setRevokingId(userId);
        setError(null);
        try {
            await pageClient.revokePermission(pageId, userId);
            setMembers(m => m.filter(r => r.permission.userId !== userId));
        } catch (e) {
            setError((e as Error).message || "Не удалось отозвать доступ");
        } finally {
            setRevokingId(null);
        }
    }

    return (
        <div className="sp">
            {/* Header */}
            <div className="sp__head">
                <div className="sp__head-top">
                    <span className="sp__title">Доступ к странице</span>
                    <button className="sp__close-btn" onClick={onClose} title="Закрыть">
                        <IconClose/>
                    </button>
                </div>
                <p className="sp__subtitle">Управляйте участниками и их ролями</p>
            </div>

            {/* Error */}
            {error && (
                <div className="sp__error" onClick={() => setError(null)}>
                    {error}
                </div>
            )}

            {/* Add member form */}
            <div className="sp__add">
                <div className="sp__add-row">
                    <input
                        className="sp__input"
                        placeholder="Логин пользователя"
                        value={login}
                        onChange={e => { setLogin(e.target.value); setFoundUser(null); setSearchErr(null); }}
                        onKeyDown={e => { if (e.key === "Enter") void handleSearch(); }}
                    />
                    <button className="sp__search-btn" onClick={handleSearch} disabled={searching || !login.trim()}>
                        {searching ? "…" : "Найти"}
                    </button>
                </div>

                {searchErr && <div className="sp__search-err">{searchErr}</div>}

                {foundUser && (
                    <div className="sp__found">
                        <span className="sp__found-name">{foundUser.login}</span>
                        <span className="sp__found-email">{foundUser.email}</span>
                        <select
                            className="sp__role-select"
                            value={role}
                            onChange={e => setRole(e.target.value as PermissionRole)}
                        >
                            {GRANTABLE_ROLES.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                        <button className="sp__grant-btn" onClick={handleGrant} disabled={granting}>
                            {granting ? "…" : "Выдать доступ"}
                        </button>
                    </div>
                )}
            </div>

            {/* Members list */}
            <div className="sp__list">
                {loading ? (
                    <div className="sp__empty">Загрузка…</div>
                ) : members.length === 0 ? (
                    <div className="sp__empty">Нет участников</div>
                ) : (
                    members.map(({ permission: p, user }) => {
                        const isOwner   = p.role === "PAGE_PERMISSION_ROLE_OWNER";
                        const revoking  = revokingId === p.userId;
                        const roleLabel = ROLE_LABELS[p.role] ?? p.role;
                        return (
                            <div key={p.id} className="sp__member">
                                <div className="sp__member-info">
                                    <span className="sp__member-login">{user?.login ?? p.userId}</span>
                                    {user?.email && <span className="sp__member-email">{user.email}</span>}
                                </div>
                                <span className={`sp__role-badge sp__role-badge--${p.role.replace("PAGE_PERMISSION_ROLE_", "").toLowerCase()}`}>
                                    {roleLabel}
                                </span>
                                {!isOwner && (
                                    <button
                                        className="sp__revoke-btn"
                                        onClick={() => void handleRevoke(p.userId)}
                                        disabled={revoking}
                                        title="Отозвать доступ"
                                    >
                                        {revoking ? "…" : <IconTrash/>}
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
