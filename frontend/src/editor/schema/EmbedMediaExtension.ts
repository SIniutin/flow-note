// ─── src/editor/schema/EmbedMediaExtension.ts ────────────────────────────────
// Блочный узел embed_media по схеме wikilive_editor_contract.
// Заменяет стандартный @tiptap/extension-image.
// Хранит только метаданные — src/media_id + render-параметры.

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { EmbedMediaNodeView } from "./EmbedMediaNodeView";

export type EmbedMediaKind = "image" | "video" | "audio" | "file" | "embed";

export interface EmbedMediaAttrs {
    block_id:   string | null;
    kind:       EmbedMediaKind;
    media_id?:  string | null;
    src?:       string | null;
    mime_type?: string | null;
    title?:     string | null;
    alt?:       string | null;
    width?:     number | null;
    height?:    number | null;
    file_name?: string | null;
    size_bytes?: number | null;
    poster?:    string | null;
}

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        embedMedia: {
            insertEmbedMedia: (attrs: Partial<EmbedMediaAttrs> & { kind: EmbedMediaKind }) => ReturnType;
        };
    }
}

export const EmbedMediaExtension = Node.create({
    name: "embedMedia",
    group: "block",
    atom: true,
    selectable: true,
    draggable: true,

    addAttributes() {
        const attr = (name: string, defaultVal: unknown = null) => ({
            [name]: {
                default: defaultVal,
                parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name.replace(/_/g, "-")}`) ?? defaultVal,
                renderHTML: (attrs: Record<string, unknown>) =>
                    attrs[name] != null ? { [`data-${name.replace(/_/g, "-")}`]: String(attrs[name]) } : {},
            },
        });

        return {
            block_id:   { default: null, parseHTML: el => el.getAttribute("data-block-id"), renderHTML: attrs => attrs.block_id ? { "data-block-id": attrs.block_id } : {} },
            kind:       { default: "image", parseHTML: el => el.getAttribute("data-kind") ?? "image", renderHTML: attrs => ({ "data-kind": attrs.kind }) },
            ...attr("media_id"),
            src:        { default: null, parseHTML: el => el.getAttribute("src") ?? el.getAttribute("data-src"), renderHTML: attrs => attrs.src ? { src: attrs.src } : {} },
            ...attr("mime_type"),
            ...attr("title"),
            alt:        { default: null, parseHTML: el => el.getAttribute("alt"), renderHTML: attrs => attrs.alt ? { alt: attrs.alt } : {} },
            width:      { default: null, parseHTML: el => el.getAttribute("width") ? Number(el.getAttribute("width")) : null, renderHTML: attrs => attrs.width ? { width: String(attrs.width) } : {} },
            height:     { default: null, parseHTML: el => el.getAttribute("height") ? Number(el.getAttribute("height")) : null, renderHTML: attrs => attrs.height ? { height: String(attrs.height) } : {} },
            ...attr("file_name"),
            ...attr("size_bytes"),
            ...attr("poster"),
        };
    },

    parseHTML() {
        return [
            // Собственный формат
            { tag: "div[data-type='embed-media']" },
            // Обратная совместимость: стандартные img теги
            { tag: "img[src]", getAttrs: el => ({
                kind: "image",
                src: (el as HTMLImageElement).getAttribute("src"),
                alt: (el as HTMLImageElement).getAttribute("alt"),
                width: (el as HTMLImageElement).getAttribute("width"),
                height: (el as HTMLImageElement).getAttribute("height"),
            })},
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const { kind, src, alt, width, height, ...rest } = HTMLAttributes;

        // Изображения рендерим как <figure><img></figure>
        if (kind === "image" || !kind) {
            return [
                "figure",
                mergeAttributes(rest, { "data-type": "embed-media", "data-kind": "image", class: "embed-media embed-media--image" }),
                ["img", { src, alt: alt ?? "", ...(width ? { width } : {}), ...(height ? { height } : {}) }],
            ];
        }

        // Остальные типы — блок-заглушка с иконкой
        const ICONS: Record<string, string> = { video: "🎬", audio: "🎵", file: "📎", embed: "🔗" };
        return [
            "div",
            mergeAttributes(rest, { "data-type": "embed-media", "data-kind": kind, class: `embed-media embed-media--${kind}` }),
            `${ICONS[kind] ?? "📄"} ${HTMLAttributes["data-title"] ?? HTMLAttributes["data-file-name"] ?? kind}`,
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(EmbedMediaNodeView);
    },

    addCommands() {
        return {
            insertEmbedMedia: (attrs) => ({ commands }) =>
                commands.insertContent({ type: this.name, attrs }),
        };
    },
});
