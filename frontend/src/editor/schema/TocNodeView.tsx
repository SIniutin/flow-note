// ─── src/editor/schema/TocNodeView.tsx ───────────────────────────────────────
// React NodeView для блока table_of_contents.
// Сканирует heading-узлы из editor.state.doc и строит интерактивное оглавление.

import { NodeViewWrapper, useEditorState } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

interface TocItem {
    level: number;
    text: string;
    pos: number;
}

function extractHeadings(doc: NodeViewProps["editor"]["state"]["doc"]): TocItem[] {
    const items: TocItem[] = [];
    doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
            items.push({
                level: node.attrs.level as number,
                text: node.textContent,
                pos,
            });
        }
    });
    return items;
}

export function TocNodeView({ editor, selected }: NodeViewProps) {
    // useEditorState подписывает NodeView на обновления документа
    useEditorState({ editor, selector: s => s.doc });

    const headings = extractHeadings(editor.state.doc);

    const handleClick = (pos: number) => {
        editor.chain()
            .focus()
            .setTextSelection(pos)
            .scrollIntoView()
            .run();

        // Дополнительно: нативный scrollIntoView для кастомного scroll-контейнера
        requestAnimationFrame(() => {
            try {
                const domPos = editor.view.domAtPos(pos);
                const el = domPos.node instanceof Element
                    ? domPos.node
                    : domPos.node.parentElement;
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
            } catch { /* pass */ }
        });
    };

    return (
        <NodeViewWrapper
            as="nav"
            className={`toc-block${selected ? " is-selected" : ""}`}
            contentEditable={false}
        >
            <div className="toc-block__header">
                <span className="toc-block__icon">☰</span>
                <span className="toc-block__title">Содержание</span>
            </div>

            {headings.length === 0 ? (
                <div className="toc-block__empty">
                    Добавьте заголовки в документ
                </div>
            ) : (
                <ol className="toc-block__list">
                    {headings.map((h, i) => (
                        <li
                            key={i}
                            className={`toc-block__item toc-block__item--h${h.level}`}
                            style={{ paddingLeft: `${(h.level - 1) * 16}px` }}
                        >
                            <button
                                className="toc-block__link"
                                onClick={() => handleClick(h.pos)}
                                title={h.text}
                            >
                                {h.text || "—"}
                            </button>
                        </li>
                    ))}
                </ol>
            )}
        </NodeViewWrapper>
    );
}
