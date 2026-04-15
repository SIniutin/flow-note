// ─── src/editor/schema/BlockIdExtension.ts ───────────────────────────────────
// Добавляет атрибут block_id (стабильный UUID) всем блочным узлам.
//
// Два механизма работают вместе:
//   1. addGlobalAttributes — объявляет атрибут и читает его из HTML при parseHTML.
//   2. appendTransaction   — после каждого изменения документа находит узлы с
//      block_id === null и записывает свежий UUID прямо в ProseMirror state.
//      Это гарантирует что Y.Doc всегда содержит UUID (y-prosemirror пропускает
//      null-атрибуты при записи в Y.XmlElement, из-за чего meta-parser не видел
//      блоки).

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

// Узлы из схемы, которым нужен block_id
const BLOCK_TYPES = [
    "paragraph",
    "heading",
    "blockquote",
    "codeBlock",
    "bulletList",
    "orderedList",
    "listItem",
    "horizontalRule",
    "mwsTable",
    "embedMedia",
    "tableOfContents",
] as const;

const BLOCK_TYPE_SET = new Set<string>(BLOCK_TYPES);

function generateBlockId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback: RFC-4122 v4-like UUID assembled from Math.random()
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

const blockIdPluginKey = new PluginKey("blockIdAssign");

export const BlockIdExtension = Extension.create({
    name: "blockId",
    priority: 1000, // выполняется раньше других расширений

    addGlobalAttributes() {
        return [
            {
                types: [...BLOCK_TYPES],
                attributes: {
                    block_id: {
                        default: null,
                        // При парсинге HTML: берём из атрибута или генерируем
                        parseHTML: el =>
                            el.getAttribute("data-block-id") ?? generateBlockId(),
                        renderHTML: attrs => ({
                            "data-block-id": attrs.block_id ?? generateBlockId(),
                        }),
                        keepOnSplit: false, // при Enter потомок получает новый id через appendTransaction
                    },
                },
            },
        ];
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: blockIdPluginKey,

                // Запускается после каждой транзакции. Если в документе
                // появились узлы без block_id — назначаем UUID и возвращаем
                // новую транзакцию. setMeta("addToHistory", false) не засоряет
                // undo-стек.
                appendTransaction(transactions, _oldState, newState) {
                    if (!transactions.some(tr => tr.docChanged)) return null;

                    const { tr } = newState;
                    let modified = false;

                    newState.doc.descendants((node, pos) => {
                        if (BLOCK_TYPE_SET.has(node.type.name) && !node.attrs.block_id) {
                            tr.setNodeMarkup(pos, undefined, {
                                ...node.attrs,
                                block_id: generateBlockId(),
                            });
                            modified = true;
                        }
                    });

                    return modified ? tr.setMeta("addToHistory", false) : null;
                },
            }),
        ];
    },
});
