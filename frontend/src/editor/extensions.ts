// ─── src/editor/extensions.ts ────────────────────────────────────────────────
// Все расширения редактора.
// Схема узлов соответствует wikilive_editor_contract v1.

import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Collaboration from "@tiptap/extension-collaboration";
import { CollaborationCursorExtension } from "./collab/CollaborationCursorExtension";
import { Extension } from "@tiptap/core";

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

import * as collabProvider from "./collab/collabProvider";
import "./collab/collab.css";
import type { EditorUser } from "../data/useCurrentUser";

export const AVATAR_COLORS: Record<1|2|3|4, string> = {
    1: "#6ad0d6",
    2: "#8b7cff",
    3: "#ffb347",
    4: "#ff7a7a",
};

// ── Keyboard shortcuts extension ──────────────────────────────────────────────
// Горячие клавиши для редактора (дополняют дефолтные из StarterKit).
// Полный список в README.md.
const KeyboardShortcuts = Extension.create({
    name: "keyboardShortcuts",

    addKeyboardShortcuts() {
        return {
            // ── Заголовки ─────────────────────────────────────────────────
            "Mod-Alt-1": () => this.editor.chain().focus().toggleHeading({ level: 1 }).run(),
            "Mod-Alt-2": () => this.editor.chain().focus().toggleHeading({ level: 2 }).run(),
            "Mod-Alt-3": () => this.editor.chain().focus().toggleHeading({ level: 3 }).run(),

            // ── Списки ───────────────────────────────────────────────────
            "Mod-Shift-8": () => this.editor.chain().focus().toggleBulletList().run(),
            "Mod-Shift-9": () => this.editor.chain().focus().toggleOrderedList().run(),

            // ── Блоки ────────────────────────────────────────────────────
            "Mod-Shift-b": () => this.editor.chain().focus().toggleBlockquote().run(),
            "Mod-Alt-c":   () => this.editor.chain().focus().toggleCodeBlock().run(),

            // ── Tab в списке: indent / outdent ────────────────────────────
            "Tab": () => {
                if (this.editor.isActive("listItem")) {
                    return this.editor.chain().focus().sinkListItem("listItem").run();
                }
                return false;
            },
            "Shift-Tab": () => {
                if (this.editor.isActive("listItem")) {
                    return this.editor.chain().focus().liftListItem("listItem").run();
                }
                return false;
            },

            // ── Slash menu ────────────────────────────────────────────────
            "Mod-/": () => {
                const { state, dispatch } = this.editor.view;
                const { tr, selection } = state;
                dispatch(tr.insertText("/", selection.from, selection.to));
                return true;
            },
        };
    },
});

export function createEditorExtensions(currentUser: EditorUser) {
    // awareness берём из live binding — актуально после connectCollab()
    collabProvider.awareness?.setLocalStateField("user", {
        name:  currentUser.name,
        color: AVATAR_COLORS[currentUser.colorIndex],
    });

    return [
        // ── StarterKit v3 ─────────────────────────────────────────────────
        // Включает: paragraph, heading, blockquote, codeBlock, bulletList,
        // orderedList, listItem, horizontalRule, bold, italic, strike,
        // underline, code, dropcursor, gapcursor.
        // undoRedo: false — Collaboration управляет undo/redo через Yjs.
        StarterKit.configure({ undoRedo: false }),

        Placeholder.configure({
            placeholder: "Начните вводить содержимое или нажмите / чтобы использовать команды",
        }),

        CharacterCount,

        // ── Schema extensions ─────────────────────────────────────────────
        BlockIdExtension,
        EmbedMediaExtension,
        PageLinkExtension,
        MediaInlineExtension,
        TableOfContentsExtension,

        // ── Collaboration (Yjs) ───────────────────────────────────────────
        // ydoc — live binding: connectCollab() обновляет значение,
        // поэтому при перемонтировании редактора используется новый doc.
        Collaboration.configure({ document: collabProvider.ydoc }),
        CollaborationCursorExtension,

        // ── Keyboard shortcuts ────────────────────────────────────────────
        KeyboardShortcuts,

        // ── App extensions ────────────────────────────────────────────────
        SlashExtension,
        CommentMark,
        MentionNode,
        MentionExtension,
        MwsTableExtension,
    ];
}

export const initialContent =
    "<h1>Добро пожаловать</h1><p>Начните вводить содержимое или нажмите <strong>/</strong> чтобы вставить блок.</p>";
