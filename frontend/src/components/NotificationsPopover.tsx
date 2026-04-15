// ─── src/components/NotificationsPopover.tsx ─────────────────────────────────
// Колокольчик с дропдауном уведомлений.
// Соединение: SSE /v1/notifications/stream?token=<jwt>.
// При reconnect делает full-fetch чтобы не пропустить события.
// Рассылает CustomEvent в окно при permission/comment нотификациях.

import { useEffect, useRef, useState, useCallback } from "react";
import { notifyClient, type Notification, NOTIFICATION_LABELS } from "../api/notifyClient";
import { getAccessToken } from "../data/authStore";
import "./notificationsPopover.css";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleString("ru-RU", {
            day: "2-digit", month: "2-digit", year: "2-digit",
            hour: "2-digit", minute: "2-digit",
        }).replace(",", " в");
    } catch { return iso; }
}

function isRead(n: Notification): boolean {
    return !!n.readAt && !n.cancelledAt;
}

const PERMISSION_TYPES = new Set([
    "NOTIFICATION_TYPE_GRAND_PERMISSION",
    "NOTIFICATION_TYPE_REVOKE_PERMISSION",
]);

const COMMENT_TYPES = new Set([
    "NOTIFICATION_TYPE_COMMENT_THREAD",
    "NOTIFICATION_TYPE_COMMENT_REPLY",
    "NOTIFICATION_TYPE_COMMENT_MENTION",
    "NOTIFICATION_TYPE_MENTION_COMMENT",
    "NOTIFICATION_TYPE_MENTION_PAGE",
]);

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationsPopover() {
    const [open, setOpen]             = useState(false);
    const [items, setItems]           = useState<Notification[]>([]);
    const [loading, setLoading]       = useState(false);
    const [markingAll, setMarkingAll] = useState(false);
    const ref    = useRef<HTMLDivElement>(null);
    const esRef  = useRef<EventSource | null>(null);

    const unreadCount = items.filter(n => !isRead(n)).length;

    // ── full fetch (initial + post-reconnect) ─────────────────────────────────
    const fetchAll = useCallback(() => {
        if (!getAccessToken()) return;
        notifyClient.getNotifications({ pageSize: 50 })
            .then(res => setItems(res?.notifications ?? []))
            .catch(() => {});
    }, []);

    // Загружаем при открытии дропдауна
    const load = () => {
        if (!getAccessToken()) return;
        setLoading(true);
        notifyClient.getNotifications({ pageSize: 50 })
            .then(res => setItems(res?.notifications ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    };
    useEffect(() => { if (open) load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── SSE ───────────────────────────────────────────────────────────────────
    const openSSE = useCallback(() => {
        const token = getAccessToken();
        if (!token) return;
        if (esRef.current && esRef.current.readyState !== EventSource.CLOSED) return;

        const url = new URL("/v1/notifications/stream", window.location.origin);
        url.searchParams.set("token", token);
        const es = new EventSource(url.toString());
        esRef.current = es;

        // При (ре)подключении синхронизируем весь список чтобы не пропустить
        // уведомления, пришедшие пока соединение было разорвано.
        es.addEventListener("open", () => { fetchAll(); });

        es.addEventListener("notification", (e: MessageEvent) => {
            try {
                const n = JSON.parse(e.data) as Notification;

                // Добавляем в список, если ещё нет
                setItems(prev =>
                    prev.some(x => x.id === n.id) ? prev : [n, ...prev],
                );

                // Рассылаем события в приложение
                if (PERMISSION_TYPES.has(n.type)) {
                    window.dispatchEvent(new CustomEvent("wiki:permission-changed"));
                }
                if (COMMENT_TYPES.has(n.type) && n.payload?.pageId) {
                    window.dispatchEvent(
                        new CustomEvent("wiki:comments-updated", {
                            detail: { pageId: n.payload.pageId },
                        }),
                    );
                }
            } catch { /* malformed JSON */ }
        });

        es.addEventListener("error", () => {
            // EventSource сам переподключается; onerror может означать как
            // временный разрыв, так и постоянную ошибку (401, 502).
            // Если соединение закрыто браузером (CLOSED) — открываем заново
            // после небольшой задержки.
            if (es.readyState === EventSource.CLOSED) {
                esRef.current = null;
                setTimeout(() => openSSE(), 5_000);
            }
        });
    }, [fetchAll]); // eslint-disable-line react-hooks/exhaustive-deps

    const closeSSE = useCallback(() => {
        esRef.current?.close();
        esRef.current = null;
    }, []);

    useEffect(() => {
        if (!getAccessToken()) return;
        fetchAll();
        openSSE();

        // При обновлении JWT-токена переподключаем SSE с новым токеном
        const onRefresh = () => { closeSSE(); openSSE(); };
        window.addEventListener("auth:token-refreshed", onRefresh);

        return () => {
            closeSSE();
            window.removeEventListener("auth:token-refreshed", onRefresh);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── закрытие по клику снаружи ─────────────────────────────────────────────
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    // ── actions ───────────────────────────────────────────────────────────────
    const handleMarkRead = async (id: string) => {
        await notifyClient.markRead(id).catch(() => {});
        setItems(prev =>
            prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n),
        );
    };

    const handleMarkAllRead = async () => {
        setMarkingAll(true);
        await notifyClient.markAllRead().catch(() => {});
        setItems(prev =>
            prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
        );
        setMarkingAll(false);
    };

    // ── render ────────────────────────────────────────────────────────────────
    return (
        <div className="notif" ref={ref}>
            <button
                className={`notif__bell${unreadCount > 0 ? " notif__bell--active" : ""}`}
                onClick={() => setOpen(o => !o)}
                title="Уведомления"
            >
                🔔
                {unreadCount > 0 && (
                    <span className="notif__badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
            </button>

            {open && (
                <div className="notif__dropdown">
                    <div className="notif__head">
                        <span className="notif__title">Уведомления</span>
                        {unreadCount > 0 && (
                            <button
                                className="notif__mark-all"
                                disabled={markingAll}
                                onClick={handleMarkAllRead}
                            >
                                {markingAll ? "…" : "Прочитать все"}
                            </button>
                        )}
                    </div>

                    <div className="notif__list">
                        {loading && <div className="notif__empty">Загрузка…</div>}
                        {!loading && items.length === 0 && (
                            <div className="notif__empty">Нет уведомлений</div>
                        )}
                        {items.map(n => (
                            <div
                                key={n.id}
                                className={`notif__item${isRead(n) ? " notif__item--read" : ""}`}
                                onClick={() => { if (!isRead(n)) void handleMarkRead(n.id); }}
                            >
                                <div className="notif__item-text">
                                    {NOTIFICATION_LABELS[n.type] ?? "Уведомление"}
                                </div>
                                {n.actorUserId && (
                                    <div className="notif__item-actor">от {n.actorUserId}</div>
                                )}
                                <div className="notif__item-date">{formatDate(n.createdAt)}</div>
                                {!isRead(n) && <div className="notif__dot"/>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
