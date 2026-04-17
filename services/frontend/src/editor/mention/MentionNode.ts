// ─── src/editor/mention/MentionNode.ts ───────────────────────────────────────
// Инлайн-узел mention по схеме wikilive_editor_contract.
// Attrs: id (entity id), label (display name без @), kind (user|team|group).
// Обратная совместимость: parseHTML принимает data-user-id как id.

import { Node, mergeAttributes } from "@tiptap/core";

export type MentionKind = "user" | "team" | "group";

export interface MentionAttrs {
    id:    string | null;
    label: string;
    kind:  MentionKind;
}

const COLOR_BY_SUFFIX: Record<string, 1|2|3|4> = {
    u_ivan: 1, u_sergey: 2, u_anna: 3, u_dmitry: 4, u_elena: 1,
};

function colorIndex(id: string | null): 1|2|3|4 {
    if (!id) return 2;
    return COLOR_BY_SUFFIX[id] ?? ((id.charCodeAt(0) % 4) + 1 as 1|2|3|4);
}

export const MentionNode = Node.create({
    name: "mention",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    draggable: false,

    addAttributes() {
        return {
            id: {
                default: null,
                // Обратная совместимость со старым data-user-id
                parseHTML: el =>
                    el.getAttribute("data-id") ??
                    el.getAttribute("data-user-id") ?? null,
                renderHTML: attrs => attrs.id ? { "data-id": attrs.id } : {},
            },
            label: {
                default: "",
                parseHTML: el =>
                    el.getAttribute("data-label") ??
                    el.textContent?.replace(/^@/, "") ?? "",
                renderHTML: attrs => attrs.label ? { "data-label": attrs.label } : {},
            },
            kind: {
                default: "user" as MentionKind,
                parseHTML: el => (el.getAttribute("data-kind") as MentionKind) ?? "user",
                renderHTML: attrs => ({ "data-kind": attrs.kind ?? "user" }),
            },
        };
    },

    parseHTML() {
        return [
            { tag: "span[data-mention][data-id]" },
            // legacy
            { tag: "span[data-mention][data-user-id]" },
        ];
    },

    renderHTML({ node }) {
        const { id, label, kind } = node.attrs as MentionAttrs;
        const ci = colorIndex(id);
        return [
            "span",
            mergeAttributes(
                {
                    "data-mention": "",
                    "data-id": id ?? "",
                    "data-label": label,
                    "data-kind": kind ?? "user",
                    class: `ui-mention ui-mention--${ci}`,
                },
            ),
            `@${label}`,
        ];
    },

    renderText({ node }) {
        return `@${(node.attrs as MentionAttrs).label}`;
    },
});
