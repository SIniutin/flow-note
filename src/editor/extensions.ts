import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import CharacterCount from "@tiptap/extension-character-count";
import Collaboration from "@tiptap/extension-collaboration";
import {SlashExtension} from "./slash/slashExtension";
import {CommentMark} from "./comments/CommentMark";
import "./comments/CommentMark.css";
import {MentionNode} from "./mention/MentionNode";
import "./mention/mentionNode.css";
import {MentionExtension} from "./mention/mentionExtension";
import {MwsTableExtension} from "./mwsTable/MwsTableExtension";
import {ydoc, awareness} from "./collab/collabProvider";
import "./collab/collab.css";
import type {User} from "../data/users";

export const AVATAR_COLORS: Record<1 | 2 | 3 | 4, string> = {
    1: "#6ad0d6",
    2: "#8b7cff",
    3: "#ffb347",
    4: "#ff7a7a",
};

export function createEditorExtensions(currentUser: User) {
    // Обновляем awareness при каждом вызове (смена пользователя)
    awareness.setLocalStateField("user", {
        name: currentUser.name,
        color: AVATAR_COLORS[currentUser.colorIndex],
    });

    return [
        // undoRedo: false — Collaboration extension управляет undo/redo через Yjs.
        // Без этого TipTap выдаёт предупреждение о конфликте расширений.
        StarterKit.configure({undoRedo: false}),

        Placeholder.configure({
            placeholder: "Начните вводить содержимое или нажмите / чтобы использовать команды",
        }),

        Image,
        CharacterCount,

        // ── Совместное редактирование (Yjs) ───────────────────────────────
        // CollaborationCursor убран: cursor-plugin из y-prosemirror несовместим
        // с @tiptap/y-tiptap который использует Collaboration v3.
        // Presence-аватары работают через awareness в PresenceAvatars.tsx.
        Collaboration.configure({
            document: ydoc,
        }),

        // ── Остальные расширения ──────────────────────────────────────────
        SlashExtension,
        CommentMark,
        MentionNode,
        MentionExtension,
        MwsTableExtension,
    ];
}

export const initialContent =
    "<h1>Отчёт за IV квартал 2024</h1><p>Отчёт включает сводку…</p>";