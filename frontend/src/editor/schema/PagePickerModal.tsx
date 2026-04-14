// ─── src/editor/schema/PagePickerModal.tsx ────────────────────────────────────
// Command-palette поповер для выбора страницы.
// Появляется у курсора (как slash-меню), а не как модал внизу.

import { useEffect, useRef, useState } from "react";
import { usePages, type WikiPage } from "../../data/pagesStore";
import "./pagePicker.css";

// ── Global promise resolver ───────────────────────────────────────────────────

let _resolver: ((page: WikiPage | null) => void) | null = null;
let _anchorRect: DOMRect | null = null;

export function openPagePicker(anchorRect?: DOMRect): Promise<WikiPage | null> {
    if (anchorRect) {
        _anchorRect = anchorRect;
    } else {
        // Fallback: попробуем взять позицию из Selection API
        const sel = window.getSelection();
        _anchorRect = sel && sel.rangeCount > 0
            ? sel.getRangeAt(0).getBoundingClientRect()
            : null;
    }

    return new Promise(resolve => {
        _resolver = resolve;
        window.dispatchEvent(new CustomEvent("wiki:open-page-picker"));
    });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PagePickerModal() {
    const pages = usePages();
    const [open, setOpen]           = useState(false);
    const [search, setSearch]       = useState("");
    const [activeIdx, setActiveIdx] = useState(0);
    const [anchor, setAnchor]       = useState<DOMRect | null>(null);
    const [pos, setPos]             = useState({ top: 0, left: 0 });

    const inputRef   = useRef<HTMLInputElement>(null);
    const listRef    = useRef<HTMLUListElement>(null);
    const panelRef   = useRef<HTMLDivElement>(null);

    // Слушаем событие открытия
    useEffect(() => {
        const handler = () => {
            setAnchor(_anchorRect ? new DOMRect(
                _anchorRect.x, _anchorRect.y,
                _anchorRect.width, _anchorRect.height,
            ) : null);
            setSearch("");
            setActiveIdx(0);
            setOpen(true);
        };
        window.addEventListener("wiki:open-page-picker", handler);
        return () => window.removeEventListener("wiki:open-page-picker", handler);
    }, []);

    // Автофокус
    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 30);
    }, [open]);

    // Позиционирование поповера у курсора
    useEffect(() => {
        if (!open || !anchor) return;

        const PANEL_W = 340;
        const PANEL_H = 320; // примерная высота
        const GAP     = 6;

        let left = anchor.left;
        let top  = anchor.bottom + GAP;

        // Не выходим за правый край
        if (left + PANEL_W > window.innerWidth - 8) {
            left = window.innerWidth - PANEL_W - 8;
        }
        // Если не влезает снизу — открываем выше курсора
        if (top + PANEL_H > window.innerHeight - 8) {
            top = anchor.top - PANEL_H - GAP;
        }

        setPos({ top: Math.max(8, top), left: Math.max(8, left) });
    }, [open, anchor]);

    // Скролл к активному элементу
    useEffect(() => {
        const list = listRef.current;
        if (!list) return;
        const el = list.children[activeIdx] as HTMLElement | undefined;
        if (!el) return;
        const listTop    = list.scrollTop;
        const listBottom = listTop + list.clientHeight;
        const elTop      = el.offsetTop;
        const elBottom   = elTop + el.offsetHeight;
        if (elBottom > listBottom) list.scrollTop = elBottom - list.clientHeight;
        else if (elTop < listTop)  list.scrollTop = elTop;
    }, [activeIdx]);

    // Клик снаружи → закрыть
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!panelRef.current?.contains(e.target as Node)) close(null);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    function close(page: WikiPage | null) {
        setOpen(false);
        _resolver?.(page);
        _resolver = null;
    }

    const filtered = pages.filter(p =>
        !search || p.title.toLowerCase().includes(search.toLowerCase()),
    );

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx(i => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (filtered[activeIdx]) close(filtered[activeIdx]);
        } else if (e.key === "Escape") {
            e.preventDefault();
            close(null);
        }
    };

    if (!open) return null;

    return (
        <div
            ref={panelRef}
            className="page-picker"
            style={{ top: pos.top, left: pos.left }}
            onKeyDown={handleKey}
        >
            {/* Поиск */}
            <div className="page-picker__search">
                <span className="page-picker__search-icon">🔍</span>
                <input
                    ref={inputRef}
                    className="page-picker__input"
                    placeholder="Найти страницу…"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setActiveIdx(0); }}
                />
                {search && (
                    <button className="page-picker__clear" onClick={() => { setSearch(""); setActiveIdx(0); inputRef.current?.focus(); }}>
                        ✕
                    </button>
                )}
            </div>

            {/* Список */}
            <ul className="page-picker__list" ref={listRef}>
                {filtered.length === 0 ? (
                    <li className="page-picker__empty">Страницы не найдены</li>
                ) : (
                    filtered.map((page, i) => (
                        <li
                            key={page.id}
                            className={`page-picker__item${i === activeIdx ? " is-active" : ""}`}
                            onMouseEnter={() => setActiveIdx(i)}
                            onMouseDown={e => { e.preventDefault(); close(page); }}
                        >
                            <span className="page-picker__item-icon">{page.icon ?? "📄"}</span>
                            <span className="page-picker__item-title">{page.title}</span>
                            {i === activeIdx && (
                                <span className="page-picker__item-hint">↵</span>
                            )}
                        </li>
                    ))
                )}
            </ul>

            {/* Подсказка */}
            <div className="page-picker__footer">
                <span>↑↓ навигация</span>
                <span>↵ выбрать</span>
                <span>Esc закрыть</span>
            </div>
        </div>
    );
}
