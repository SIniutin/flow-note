// ─── src/editor/extensions.ts ────────────────────────────────────────────────
// Все расширения редактора.
// Схема узлов соответствует wikilive_editor_contract v1.

import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Collaboration from "@tiptap/extension-collaboration";

import { BlockIdExtension }          from "./schema/BlockIdExtension";
import { EmbedMediaExtension }       from "./schema/EmbedMediaExtension";
import { PageLinkExtension }         from "./schema/PageLinkExtension";
import { MediaInlineExtension }      from "./schema/MediaInlineExtension";
import { TableOfContentsExtension }  from "./schema/TableOfContentsExtension";
import "./schema/schema.css";

import { SlashExtension }    from "./slash/slashExtension";
import { CommentMark }       from "./comments/CommentMark";
import "./comments/CommentMark.css";
import { MentionNode }       from "./mention/MentionNode";
import "./mention/mentionNode.css";
import { MentionExtension }  from "./mention/mentionExtension";
import { MwsTableExtension } from "./mwsTable/MwsTableExtension";

import { ydoc, awareness } from "./collab/collabProvider";
import "./collab/collab.css";
import type { User } from "../data/users";

export const AVATAR_COLORS: Record<1|2|3|4, string> = {
    1: "#6ad0d6",
    2: "#8b7cff",
    3: "#ffb347",
    4: "#ff7a7a",
};

export function createEditorExtensions(currentUser: User) {
    awareness.setLocalStateField("user", {
        name:  currentUser.name,
        color: AVATAR_COLORS[currentUser.colorIndex],
    });

    return [
        // ── StarterKit v3 ─────────────────────────────────────────────────
        // Включает: paragraph, heading, blockquote, codeBlock, bulletList,
        // orderedList, listItem, horizontalRule, bold, italic, strike,
        // underline, code, link, dropcursor, gapcursor.
        // undoRedo: false — Collaboration управляет undo/redo через Yjs.
        StarterKit.configure({ undoRedo: false }),

        Placeholder.configure({
            placeholder: "Начните вводить содержимое или нажмите / чтобы использовать команды",
        }),

        CharacterCount,

        // ── Schema extensions ─────────────────────────────────────────────
        // block_id для всех блоков
        BlockIdExtension,

        // embed_media — заменяет @tiptap/extension-image
        EmbedMediaExtension,

        // page_link — внутренняя ссылка на вики-страницу
        PageLinkExtension,

        // media_inline — эмодзи, иконки, стикеры, инлайн-файлы
        MediaInlineExtension,

        // table_of_contents — автооглавление из заголовков
        TableOfContentsExtension,

        // ── Collaboration (Yjs) ───────────────────────────────────────────
        Collaboration.configure({ document: ydoc }),

        // ── App extensions ────────────────────────────────────────────────
        SlashExtension,
        CommentMark,
        MentionNode,
        MentionExtension,
        MwsTableExtension,
    ];
}

export const initialContent =
    "<h1>Отчёт за IV квартал 2024</h1><p>Отчёт включает сводку…</p>";
