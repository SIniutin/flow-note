import { Node, mergeAttributes } from "@tiptap/core";
import { getUserById } from "../../data/users";

export interface MentionOptions {
    HTMLAttributes: Record<string, unknown>;
}

export const MentionNode = Node.create<MentionOptions>({
    name: "mention",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    draggable: false,

    addOptions() { return { HTMLAttributes: {} }; },

    addAttributes() {
        return {
            userId: {
                default: null,
                parseHTML: el => (el as HTMLElement).getAttribute("data-user-id"),
                renderHTML: attrs => attrs.userId ? { "data-user-id": attrs.userId } : {},
            },
        };
    },

    parseHTML() {
        return [{ tag: "span[data-mention][data-user-id]" }];
    },

    renderHTML({ node, HTMLAttributes }) {
        const user = node.attrs.userId ? getUserById(node.attrs.userId) : null;
        const label = user ? user.name : "Неизвестный пользователь";
        const colorClass = user ? `ui-mention--${user.colorIndex}` : "ui-mention--1";
        return [
            "span",
            mergeAttributes(
                { "data-mention": "", class: `ui-mention ${colorClass}` },
                this.options.HTMLAttributes,
                HTMLAttributes,
            ),
            `@${label}`,
        ];
    },

    renderText({ node }) {
        const user = node.attrs.userId ? getUserById(node.attrs.userId) : null;
        return user ? `@${user.name}` : "@unknown";
    },
});