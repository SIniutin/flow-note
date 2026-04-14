// ─── src/editor/schema/PageLinkExtension.ts ──────────────────────────────────
// Инлайн-узел page_link по схеме wikilive_editor_contract.
// Внутренняя ссылка на другую вики-страницу.
// Включает ProseMirror-плагин для синхронизации pagelinksStore.

import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { pagelinksStore } from "../../data/pagelinksStore";
import { pagesStore } from "../../data/pagesStore";

export interface PageLinkAttrs {
    page_id:          string;
    label:            string;
    anchor_block_id?: string | null;
}

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        pageLink: {
            insertPageLink: (attrs: PageLinkAttrs) => ReturnType;
        };
    }
}

export const PageLinkExtension = Node.create({
    name: "pageLink",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    draggable: false,

    addAttributes() {
        return {
            page_id: {
                default: null,
                parseHTML: el => el.getAttribute("data-page-id"),
                renderHTML: attrs => attrs.page_id ? { "data-page-id": attrs.page_id } : {},
            },
            label: {
                default: "",
                parseHTML: el => el.getAttribute("data-label") ?? el.textContent ?? "",
                renderHTML: attrs => attrs.label ? { "data-label": attrs.label } : {},
            },
            anchor_block_id: {
                default: null,
                parseHTML: el => el.getAttribute("data-anchor-block-id") ?? null,
                renderHTML: attrs => attrs.anchor_block_id
                    ? { "data-anchor-block-id": attrs.anchor_block_id }
                    : {},
            },
        };
    },

    parseHTML() {
        return [{ tag: "a[data-page-link][data-page-id]" }];
    },

    renderHTML({ node, HTMLAttributes }) {
        const label = node.attrs.label ?? "Страница";
        return [
            "a",
            mergeAttributes(
                { "data-page-link": "", class: "page-link", href: "#" },
                HTMLAttributes,
            ),
            `📄 ${label}`,
        ];
    },

    renderText({ node }) {
        return node.attrs.label ?? "";
    },

    addCommands() {
        return {
            insertPageLink: (attrs: PageLinkAttrs) => ({ commands }) =>
                commands.insertContent({ type: this.name, attrs }),
        };
    },

    addProseMirrorPlugins() {
        const syncLinks = (doc: import("@tiptap/pm/model").Node) => {
            const pageIds: string[] = [];
            doc.descendants(node => {
                if (node.type.name === "pageLink" && node.attrs.page_id) {
                    pageIds.push(node.attrs.page_id as string);
                }
            });
            Promise.resolve().then(() => {
                const current = pagesStore.getCurrent();
                if (current) {
                    pagelinksStore.syncPage(current.id, current.title, pageIds);
                }
            });
        };

        return [
            new Plugin({
                key: new PluginKey("pageLinkBacklinks"),
                view(editorView) {
                    syncLinks(editorView.state.doc);
                    return {
                        update(view, prevState) {
                            if (view.state.doc !== prevState.doc) {
                                syncLinks(view.state.doc);
                            }
                        },
                    };
                },
            }),
        ];
    },
});
