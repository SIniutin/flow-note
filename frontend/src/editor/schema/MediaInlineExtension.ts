// ─── src/editor/schema/MediaInlineExtension.ts ───────────────────────────────
// Инлайн-узел media_inline по схеме wikilive_editor_contract.
// Используется для эмодзи, иконок, стикеров, инлайн-файлов внутри текста.

import { Node, mergeAttributes } from "@tiptap/core";

export type MediaInlineKind = "emoji" | "icon" | "sticker" | "inline_file";

export interface MediaInlineAttrs {
    kind:       MediaInlineKind;
    media_id?:  string | null;
    src?:       string | null;
    mime_type?: string | null;
    title?:     string | null;
}

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        mediaInline: {
            insertMediaInline: (attrs: MediaInlineAttrs) => ReturnType;
            insertEmoji:       (emoji: string, title?: string) => ReturnType;
        };
    }
}

export const MediaInlineExtension = Node.create({
    name: "mediaInline",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    draggable: false,

    addAttributes() {
        return {
            kind: {
                default: "emoji" as MediaInlineKind,
                parseHTML: el => (el.getAttribute("data-kind") as MediaInlineKind) ?? "emoji",
                renderHTML: attrs => ({ "data-kind": attrs.kind }),
            },
            media_id: {
                default: null,
                parseHTML: el => el.getAttribute("data-media-id") ?? null,
                renderHTML: attrs => attrs.media_id ? { "data-media-id": attrs.media_id } : {},
            },
            src: {
                default: null,
                parseHTML: el => el.getAttribute("data-src") ?? el.getAttribute("src") ?? null,
                renderHTML: attrs => attrs.src ? { "data-src": attrs.src } : {},
            },
            mime_type: {
                default: null,
                parseHTML: el => el.getAttribute("data-mime-type") ?? null,
                renderHTML: attrs => attrs.mime_type ? { "data-mime-type": attrs.mime_type } : {},
            },
            title: {
                default: null,
                parseHTML: el => el.getAttribute("data-title") ?? el.getAttribute("title") ?? null,
                renderHTML: attrs => attrs.title ? { "data-title": attrs.title, title: attrs.title } : {},
            },
        };
    },

    parseHTML() {
        return [
            { tag: "span[data-media-inline]" },
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        const { kind, src, title, media_id } = node.attrs as MediaInlineAttrs;

        // Эмодзи и простые символьные иконки
        if (kind === "emoji") {
            return [
                "span",
                mergeAttributes(
                    { "data-media-inline": "", class: "media-inline media-inline--emoji" },
                    HTMLAttributes,
                ),
                // title хранит сам символ эмодзи
                title ?? "🔹",
            ];
        }

        // Картинка-иконка из src
        if (kind === "icon" || kind === "sticker") {
            if (src) {
                return [
                    "span",
                    mergeAttributes(
                        { "data-media-inline": "", class: `media-inline media-inline--${kind}` },
                        HTMLAttributes,
                    ),
                    ["img", { src, alt: title ?? "", class: "media-inline__img" }],
                ];
            }
            // Иконка по media_id — рендерим как текстовый код
            return [
                "span",
                mergeAttributes(
                    { "data-media-inline": "", class: "media-inline media-inline--icon" },
                    HTMLAttributes,
                ),
                media_id ?? "□",
            ];
        }

        // Инлайн-файл
        if (kind === "inline_file") {
            return [
                "span",
                mergeAttributes(
                    { "data-media-inline": "", class: "media-inline media-inline--file" },
                    HTMLAttributes,
                ),
                `📎 ${title ?? media_id ?? "file"}`,
            ];
        }

        return ["span", mergeAttributes({ "data-media-inline": "" }, HTMLAttributes), ""];
    },

    renderText({ node }) {
        const { kind, title } = node.attrs as MediaInlineAttrs;
        if (kind === "emoji") return title ?? "";
        return title ?? "";
    },

    addCommands() {
        return {
            insertMediaInline: (attrs: MediaInlineAttrs) => ({ commands }) =>
                commands.insertContent({ type: this.name, attrs }),

            // Быстрый хелпер для эмодзи
            insertEmoji: (emoji: string, title?: string) => ({ commands }) =>
                commands.insertContent({
                    type: this.name,
                    attrs: { kind: "emoji", title: emoji, media_id: null, src: null },
                }),
        };
    },
});
