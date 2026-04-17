// ─── src/editor/ContextMenu.tsx ───────────────────────────────────────────────
// Кастомное контекстное меню редактора (ПКМ).

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { openPagePicker } from "./schema/PagePickerModal";
import { pagesStore } from "../data/pagesStore";
import "./contextMenu.css";

interface Props {
    editor: Editor | null;
    onAddComment: () => void;
}

interface MenuItem {
    label: string;
    shortcut?: string;
    onClick: () => void;
    disabled?: boolean;
}

type Row = MenuItem | "divider";

export function EditorContextMenu({ editor, onAddComment }: Props) {
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const close = useCallback(() => setPos(null), []);

    // Вешаем contextmenu на DOM редактора (после create, т.к. view готов позже).
    useEffect(() => {
        if (!editor) return;

        let domCleanup: (() => void) | undefined;

        const attach = () => {
            if (editor.isDestroyed) return;
            const dom = editor.view.dom as HTMLElement;
            const handler = (e: MouseEvent) => {
                e.preventDefault();
                setPos({ x: e.clientX, y: e.clientY });
            };
            dom.addEventListener("contextmenu", handler);
            domCleanup = () => dom.removeEventListener("contextmenu", handler);
        };

        editor.on("create", attach);
        attach(); // редактор мог уже быть создан

        return () => {
            editor.off("create", attach);
            domCleanup?.();
        };
    }, [editor]);

    // Закрытие — клик снаружи
    useEffect(() => {
        if (!pos) return;
        const handler = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) close();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [pos, close]);

    // Закрытие — Escape / скролл
    useEffect(() => {
        if (!pos) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
        const onScroll = () => close();
        document.addEventListener("keydown", onKey);
        document.addEventListener("scroll", onScroll, true);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("scroll", onScroll, true);
        };
    }, [pos, close]);

    // Прижимаем меню к экрану после первого рендера
    useEffect(() => {
        if (!pos || !menuRef.current) return;
        const { width, height } = menuRef.current.getBoundingClientRect();
        const x = Math.min(pos.x, window.innerWidth  - width  - 8);
        const y = Math.min(pos.y, window.innerHeight - height - 8);
        if (x !== pos.x || y !== pos.y) setPos({ x, y });
    }, [pos]);

    if (!pos || !editor) return null;

    const hasSelection = !editor.state.selection.empty;
    const canUndo = editor.can().undo();
    const canRedo = editor.can().redo();

    const run = (fn: () => void) => { fn(); close(); };

    const rows: Row[] = [
        {
            label: "Отменить",
            shortcut: "Ctrl+Z",
            disabled: !canUndo,
            onClick: () => run(() => editor.chain().focus().undo().run()),
        },
        {
            label: "Повторить",
            shortcut: "Ctrl+Y",
            disabled: !canRedo,
            onClick: () => run(() => editor.chain().focus().redo().run()),
        },
        "divider",
        {
            label: "Вырезать",
            shortcut: "Ctrl+X",
            disabled: !hasSelection,
            onClick: () => run(() => document.execCommand("cut")),
        },
        {
            label: "Копировать",
            shortcut: "Ctrl+C",
            disabled: !hasSelection,
            onClick: () => run(() => document.execCommand("copy")),
        },
        {
            label: "Вставить",
            shortcut: "Ctrl+V",
            onClick: () => run(() => {
                (editor.view.dom as HTMLElement).focus();
                document.execCommand("paste");
            }),
        },
        "divider",
        {
            label: "Жирный",
            shortcut: "Ctrl+B",
            disabled: !hasSelection,
            onClick: () => run(() => editor.chain().focus().toggleBold().run()),
        },
        {
            label: "Курсив",
            shortcut: "Ctrl+I",
            disabled: !hasSelection,
            onClick: () => run(() => editor.chain().focus().toggleItalic().run()),
        },
        {
            label: "Зачёркнутый",
            disabled: !hasSelection,
            onClick: () => run(() => editor.chain().focus().toggleStrike().run()),
        },
        {
            label: "Очистить форматирование",
            disabled: !hasSelection,
            onClick: () => run(() => editor.chain().focus().unsetAllMarks().run()),
        },
        "divider",
        {
            label: "Добавить комментарий",
            disabled: !hasSelection,
            onClick: () => run(() => onAddComment()),
        },
        {
            label: "Ссылка на страницу",
            onClick: () => run(() => {
                const sel = editor.state.selection;
                const coords = editor.view.coordsAtPos(sel.from);
                const rect = new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top);
                openPagePicker(rect, pagesStore.getCurrentId()).then(page => {
                    if (!page) return;
                    editor.chain().focus().insertPageLink({
                        page_id: page.id,
                        label:   page.title,
                    }).run();
                });
            }),
        },
    ];

    return (
        <div
            ref={menuRef}
            className="ctx-menu"
            style={{ left: pos.x, top: pos.y }}
            onContextMenu={e => e.preventDefault()}
        >
            {rows.map((row, i) =>
                row === "divider" ? (
                    <div key={i} className="ctx-menu__divider" />
                ) : (
                    <button
                        key={i}
                        className={`ctx-menu__item${row.disabled ? " ctx-menu__item--disabled" : ""}`}
                        onClick={row.disabled ? undefined : row.onClick}
                    >
                        <span className="ctx-menu__label">{row.label}</span>
                        {row.shortcut && (
                            <span className="ctx-menu__shortcut">{row.shortcut}</span>
                        )}
                    </button>
                ),
            )}
        </div>
    );
}
