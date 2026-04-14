// ─── src/components/BacklinksPanel.tsx ───────────────────────────────────────
// Панель обратных ссылок — какие страницы ссылаются на текущую.

import { useIncomingLinks } from "../data/pagelinksStore";
import { pagesStore } from "../data/pagesStore";
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

interface BacklinksPanelProps {
    pageId:     string;
    onNavigate: (id: string) => void;
    onClose:    () => void;
}

export function BacklinksPanel({ pageId, onNavigate, onClose }: BacklinksPanelProps) {
    const links = useIncomingLinks(pageId);

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
                    links.map(link => {
                        const page = pagesStore.get(link.fromId);
                        return (
                            <button
                                key={link.id}
                                className="bl__item"
                                onClick={() => onNavigate(link.fromId)}
                            >
                                <span className="bl__item-icon">{page?.icon ?? "📄"}</span>
                                <span className="bl__item-body">
                                    <span className="bl__item-title">{link.fromTitle}</span>
                                    <span className="bl__item-date">
                                        {new Date(link.createdAt).toLocaleDateString("ru-RU", {
                                            day: "2-digit", month: "short",
                                        })}
                                    </span>
                                </span>
                                <span className="bl__item-arrow"><IconArrow/></span>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
