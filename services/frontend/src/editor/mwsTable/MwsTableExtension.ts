// ─── src/editor/mwsTable/MwsTableExtension.ts ────────────────────────────────
// Атрибуты приведены к схеме wikilive_editor_contract:
//   dst_id   ← идентификатор таблицы MWS (было: tableId)
//   view_id  ← опциональный id представления (новый)
//   title    ← заголовок-оверрайд (было: caption)
//   display  ← "table" | "cards" (было: viewMode compact/full/card)
//   block_id ← управляет BlockIdExtension, но объявляем для совместимости

import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MwsTableNodeView } from "./MwsTableNodeView";
import { backlinksStore } from "./backlinksStore";

export interface MwsTableSchemaAttrs {
    block_id:  string | null;
    dst_id:    string | null;       // id таблицы (was: tableId)
    view_id?:  string | null;       // id представления MWS
    title?:    string | null;       // display title (was: caption)
    display?:  "table" | "full" | "cards";  // render mode (was: viewMode)
    // legacy — kept for backward compat with old saved docs
    maxRows?:  number;
}

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        mwsTable: {
            insertMwsTable: (attrs: MwsTableSchemaAttrs) => ReturnType;
            updateMwsTable: (attrs: Partial<MwsTableSchemaAttrs>) => ReturnType;
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
            block_id: {
                default: null,
                parseHTML: el => el.getAttribute("data-block-id"),
                renderHTML: attrs => attrs.block_id ? { "data-block-id": attrs.block_id } : {},
            },
            // ── Schema attrs ───────────────────────────────────────────────
            dst_id: {
                default: null,
                parseHTML: el =>
                    el.getAttribute("data-dst-id") ??
                    el.getAttribute("data-table-id"), // legacy
                renderHTML: attrs => attrs.dst_id ? { "data-dst-id": attrs.dst_id } : {},
            },
            view_id: {
                default: null,
                parseHTML: el => el.getAttribute("data-view-id") ?? null,
                renderHTML: attrs => attrs.view_id ? { "data-view-id": attrs.view_id } : {},
            },
            title: {
                default: null,
                parseHTML: el =>
                    el.getAttribute("data-title") ??
                    el.getAttribute("data-caption"), // legacy
                renderHTML: attrs => attrs.title ? { "data-title": attrs.title } : {},
            },
            display: {
                default: "table" as "table" | "full" | "cards",
                parseHTML: el => {
                    const v = el.getAttribute("data-display") ?? el.getAttribute("data-view-mode");
                    if (v === "card" || v === "cards") return "cards";
                    if (v === "full") return "full";
                    return "table";
                },
                renderHTML: attrs => ({ "data-display": attrs.display ?? "table" }),
            },
            // ── Legacy attrs (backward compat) ─────────────────────────────
            maxRows: {
                default: 5,
                parseHTML: el => Number(el.getAttribute("data-max-rows") ?? 5),
                renderHTML: attrs => ({ "data-max-rows": String(attrs.maxRows ?? 5) }),
            },
        };
    },

    parseHTML() {
        return [{ tag: "div[data-type='mws-table']" }];
    },

    renderHTML({ HTMLAttributes }) {
        return ["div", mergeAttributes(HTMLAttributes, { "data-type": "mws-table" })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(MwsTableNodeView);
    },

    addCommands() {
        return {
            insertMwsTable: (attrs: MwsTableSchemaAttrs) => ({ commands }) =>
                commands.insertContent({ type: this.name, attrs }),

            updateMwsTable: (attrs: Partial<MwsTableSchemaAttrs>) => ({ commands }) =>
                commands.updateAttributes(this.name, attrs),
        };
    },

    addProseMirrorPlugins() {
        const DOC_ID    = "doc_main";
        const DOC_TITLE = "Новая страница";

        const syncDoc = (doc: import("@tiptap/pm/model").Node) => {
            const tableIds: string[] = [];
            doc.descendants(node => {
                // Читаем dst_id (новый) или tableId (legacy)
                const id = node.attrs.dst_id ?? node.attrs.tableId;
                if (node.type.name === "mwsTable" && id) {
                    tableIds.push(id as string);
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
                    syncDoc(editorView.state.doc);
                    return {
                        update(view, prevState) {
                            if (view.state.doc === prevState.doc) return;
                            syncDoc(view.state.doc);
                        },
                    };
                },
            }),
        ];
    },
});
