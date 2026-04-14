// ─── src/components/BacklinksPanel.tsx ───────────────────────────────────────
// Панель обратных ссылок — какие страницы ссылаются на текущую.

import { useEffect, useState } from "react";
import { pageClient, type BackendPage, type BackendPageLink } from "../api/pageClient";
import { useIncomingLinks } from "../data/pagelinksStore";
import { pagesStore } from "../data/pagesStore";
import { getAccessToken } from "../data/authStore";
import "./backlinksPanel.css";

function IconClose() {
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="3" x2="13" y2="13"/>
            <line x1="13" y1="3" x2="3" y2="13"/>
        </svg>
    );
}
function IconLink() {
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 9.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5L7 4"/>
            <path d="M9.5 6.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5L9 12"/>
        </svg>
    );
}
function IconArrow() {
    return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="8" x2="13" y2="8"/>
            <polyline points="9,4 13,8 9,12"/>
        </svg>
    );
}

interface BacklinkItem {
    id:        string;
    fromId:    string;
    fromTitle: string;
    fromIcon?: string;
}

interface BacklinksPanelProps {
    pageId:     string;
    onNavigate: (id: string) => void;
    onClose:    () => void;
}

export function BacklinksPanel({ pageId, onNavigate, onClose }: BacklinksPanelProps) {
    // Данные с бэкенда
    const [backendLinks, setBackendLinks] = useState<BacklinkItem[] | null>(null);

    useEffect(() => {
        if (!getAccessToken()) { setBackendLinks(null); return; }
        setBackendLinks(null);
        pageClient.getConnected(pageId)
            .then(({ pages, links }: { pages: BackendPage[]; links: BackendPageLink[] }) => {
                const pageMap = new Map(pages.map(p => [p.id, p]));
                const incoming = links
                    .filter(l => l.toPageId === pageId)
                    .map(l => ({
                        id:        l.id,
                        fromId:    l.fromPageId,
                        fromTitle: pageMap.get(l.fromPageId)?.title ?? "Без названия",
                        fromIcon:  pagesStore.get(l.fromPageId)?.icon,
                    }));
                setBackendLinks(incoming);
            })
            .catch(() => setBackendLinks(null));
    }, [pageId]);

    // Fallback: локальный стор (до ответа от бэкенда или если нет токена)
    const localLinks = useIncomingLinks(pageId);

    const links: BacklinkItem[] = backendLinks ?? localLinks.map(l => ({
        id:        l.id,
        fromId:    l.fromId,
        fromTitle: l.fromTitle,
        fromIcon:  pagesStore.get(l.fromId)?.icon,
    }));

    return (
        <div className="bl">
            {/* Header */}
            <div className="bl__head">
                <div className="bl__head-top">
                    <div className="bl__head-left">
                        <span className="bl__title">Обратные ссылки</span>
                        {links.length > 0 && <span className="bl__count">{links.length}</span>}
                    </div>
                    <button className="bl__close-btn" onClick={onClose} title="Закрыть">
                        <IconClose/>
                    </button>
                </div>
                <p className="bl__subtitle">
                    Страницы, которые ссылаются на текущую через&nbsp;
                    <kbd className="bl__kbd">/страница</kbd>
                </p>
            </div>

            {/* List */}
            <div className="bl__list">
                {links.length === 0 ? (
                    <div className="bl__empty">
                        <IconLink/>
                        <span>Ни одна страница не ссылается на эту.</span>
                        <span>Вставьте ссылку через <kbd className="bl__kbd">/страница</kbd> в редакторе.</span>
                    </div>
                ) : (
                    links.map(link => (
                        <button
                            key={link.id}
                            className="bl__item"
                            onClick={() => onNavigate(link.fromId)}
                        >
                            <span className="bl__item-icon">{link.fromIcon ?? "📄"}</span>
                            <span className="bl__item-body">
                                <span className="bl__item-title">{link.fromTitle}</span>
                            </span>
                            <span className="bl__item-arrow"><IconArrow/></span>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
