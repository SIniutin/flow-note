// ─── src/components/NotificationsPopover.tsx ─────────────────────────────────
// Колокольчик с дропдауном уведомлений.

import { useEffect, useRef, useState } from "react";
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

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationsPopover() {
    const [open, setOpen]               = useState(false);
    const [items, setItems]             = useState<Notification[]>([]);
    const [loading, setLoading]         = useState(false);
    const [markingAll, setMarkingAll]   = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const unreadCount = items.filter(n => !isRead(n)).length;

    const load = () => {
        if (!getAccessToken()) return;
        setLoading(true);
        notifyClient.getNotifications({ pageSize: 50 })
            .then(res => setItems(res?.notifications ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    // Загружаем при открытии
    useEffect(() => { if (open) load(); }, [open]);

    // Периодически обновляем счётчик (раз в 30с)
    useEffect(() => {
        if (!getAccessToken()) return;
        notifyClient.getNotifications({ pageSize: 50 }).then(res => setItems(res?.notifications ?? [])).catch(() => {});
        const t = setInterval(() => {
            notifyClient.getNotifications({ pageSize: 50 }).then(res => setItems(res?.notifications ?? [])).catch(() => {});
        }, 30_000);
        return () => clearInterval(t);
    }, []);

    // Закрытие при клике снаружи
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const handleMarkRead = async (id: string) => {
        await notifyClient.markRead(id).catch(() => {});
        setItems(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    };

    const handleMarkAllRead = async () => {
        setMarkingAll(true);
        await notifyClient.markAllRead().catch(() => {});
        setItems(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
        setMarkingAll(false);
    };

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
                        {loading && (
                            <div className="notif__empty">Загрузка…</div>
                        )}
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
