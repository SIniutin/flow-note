// ─── src/editor/schema/BlockIdExtension.ts ───────────────────────────────────
// Добавляет атрибут block_id (стабильный UUID) всем блочным узлам.
// По схеме: "all block nodes must have block_id" и "block_id must be stable
// and unique within the document".
//
// Используем Extension.create с глобальным addGlobalAttributes — это
// самый чистый способ добавить атрибут всем указанным типам узлов сразу.

import { Extension } from "@tiptap/core";

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

function generateBlockId(): string {
    // crypto.randomUUID() — доступен во всех modern браузерах
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Фоллбэк для старых сред
    return "b-" + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

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
                        // Генерируем block_id если его нет при парсинге
                        parseHTML: el =>
                            el.getAttribute("data-block-id") ?? generateBlockId(),
                        renderHTML: attrs => {
                            // Если block_id не назначен — генерируем на лету
                            const id = attrs.block_id ?? generateBlockId();
                            return { "data-block-id": id };
                        },
                        keepOnSplit: false, // при Enter генерируем новый id
                    },
                },
            },
        ];
    },
});
