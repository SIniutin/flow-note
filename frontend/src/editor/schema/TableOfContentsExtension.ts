// ─── src/editor/schema/TableOfContentsExtension.ts ───────────────────────────
// Блок table_of_contents по схеме wikilive_editor_contract.
// Автоматически генерирует оглавление из heading-узлов документа.
// Обновляется при каждом изменении документа.

import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TocNodeView } from "./TocNodeView";

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        tableOfContents: {
            insertTableOfContents: () => ReturnType;
        };
    }
}

export const TableOfContentsExtension = Node.create({
    name: "tableOfContents",
    group: "block",
    atom: true,
    selectable: true,
    draggable: true,

    addAttributes() {
        return {
            block_id: {
                default: null,
                parseHTML: el => el.getAttribute("data-block-id"),
                renderHTML: attrs => attrs.block_id ? { "data-block-id": attrs.block_id } : {},
            },
        };
    },

    parseHTML() {
        return [{ tag: "div[data-type='table-of-contents']" }];
    },

    renderHTML({ HTMLAttributes }) {
        return ["div", mergeAttributes(HTMLAttributes, { "data-type": "table-of-contents" })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(TocNodeView);
    },

    addCommands() {
        return {
            insertTableOfContents: () => ({ commands }) =>
                commands.insertContent({ type: this.name }),
        };
    },

    // Плагин нужен только чтобы NodeView автоматически обновлялся
    // при изменении заголовков — NodeView сам читает editor.state.doc.
    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey("tableOfContents"),
                // Пустой плагин — обновление происходит через NodeViewProps
            }),
        ];
    },
});
