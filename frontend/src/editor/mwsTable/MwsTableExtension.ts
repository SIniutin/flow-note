// ─── src/editor/mwsTable/MwsTableExtension.ts ────────────────────────────────

import {Node, mergeAttributes} from "@tiptap/core";
import {Plugin, PluginKey} from "@tiptap/pm/state";
import {ReactNodeViewRenderer} from "@tiptap/react";
import {MwsTableNodeView} from "./MwsTableNodeView";
import {backlinksStore} from "./backlinksStore";
import type {MwsTableNodeAttrs} from "../../types/mwsTable";

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        mwsTable: {
            insertMwsTable: (attrs: MwsTableNodeAttrs) => ReturnType;
            updateMwsTable: (attrs: Partial<MwsTableNodeAttrs>) => ReturnType;
        };
    }
}

export const MwsTableExtension = Node.create({
    name: "mwsTable",
    group: "block",
    atom: true,
    selectable: true,
    draggable: true,
    isolating: true,

    addAttributes() {
        return {
            tableId: {
                default: null,
                parseHTML: el => el.getAttribute("data-table-id"),
                renderHTML: attrs => attrs.tableId ? {"data-table-id": attrs.tableId} : {},
            },
            viewMode: {
                default: "compact" as MwsTableNodeAttrs["viewMode"],
                parseHTML: el => el.getAttribute("data-view-mode") ?? "compact",
                renderHTML: attrs => ({"data-view-mode": attrs.viewMode}),
            },
            pinnedColumns: {
                default: null,
                parseHTML: el => {
                    const raw = el.getAttribute("data-pinned-columns");
                    return raw ? JSON.parse(raw) : null;
                },
                renderHTML: attrs => attrs.pinnedColumns
                    ? {"data-pinned-columns": JSON.stringify(attrs.pinnedColumns)}
                    : {},
            },
            maxRows: {
                default: 5,
                parseHTML: el => Number(el.getAttribute("data-max-rows") ?? 5),
                renderHTML: attrs => ({"data-max-rows": String(attrs.maxRows)}),
            },
            caption: {
                default: null,
                parseHTML: el => el.getAttribute("data-caption") ?? null,
                renderHTML: attrs => attrs.caption ? {"data-caption": attrs.caption} : {},
            },
        };
    },

    parseHTML() {
        return [{tag: "div[data-type='mws-table']"}];
    },

    renderHTML({HTMLAttributes}) {
        return ["div", mergeAttributes(HTMLAttributes, {"data-type": "mws-table"})];
    },

    addNodeView() {
        return ReactNodeViewRenderer(MwsTableNodeView);
    },

    addCommands() {
        return {
            insertMwsTable: (attrs: MwsTableNodeAttrs) => ({commands}) =>
                commands.insertContent({type: this.name, attrs}),

            updateMwsTable: (attrs: Partial<MwsTableNodeAttrs>) => ({commands}) =>
                commands.updateAttributes(this.name, attrs),
        };
    },

    // ── ProseMirror plugin: синхронизирует backlinks при каждом изменении doc ──
    // Сканирует все mwsTable-узлы в документе и вызывает backlinksStore.syncDoc.
    // Идемпотентен — не создаёт дублей, корректно обрабатывает undo/redo.

    addProseMirrorPlugins() {
        const DOC_ID = "doc_main";
        const DOC_TITLE = "Новая страница";

        const syncDoc = (doc: import("@tiptap/pm/model").Node) => {
            const tableIds: string[] = [];
            doc.descendants(node => {
                if (node.type.name === "mwsTable" && node.attrs.tableId) {
                    tableIds.push(node.attrs.tableId as string);
                }
            });
            Promise.resolve().then(() => {
                backlinksStore.syncDoc(DOC_ID, DOC_TITLE, tableIds);
            });
        };

        return [
            new Plugin({
                key: new PluginKey("mwsTableBacklinks"),
                view(editorView) {
                    // Синхронизация при первом монтировании —
                    // doc уже загружен из localStorage, update не сработает
                    syncDoc(editorView.state.doc);

                    return {
                        update(view, prevState) {
                            // Синхронизация при каждом изменении doc
                            if (view.state.doc === prevState.doc) return;
                            syncDoc(view.state.doc);
                        },
                    };
                },
            }),
        ];
    },
});