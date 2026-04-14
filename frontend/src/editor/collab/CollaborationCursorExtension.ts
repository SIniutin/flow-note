// ─── src/editor/collab/CollaborationCursorExtension.ts ────────────────────────
// Замена @tiptap/extension-collaboration-cursor v3.0.0, которая несовместима
// с @tiptap/extension-collaboration v3.22.3+.
// Причина: collaboration v3.22.3 использует ySyncPluginKey из @tiptap/y-tiptap,
// а collaboration-cursor v3.0.0 использует ySyncPluginKey из y-prosemirror —
// разные ключи, getState() возвращает undefined → краш «ystate is undefined».
//
// Это расширение берёт yCursorPlugin напрямую из @tiptap/y-tiptap и использует
// те же CSS-классы (.collaboration-cursor__caret / __label), что и collab.css.

import { Extension } from "@tiptap/core";
import { yCursorPlugin } from "@tiptap/y-tiptap";
import { awareness } from "./collabProvider";

function buildCursor(user: { name?: string; color?: string }): HTMLElement {
    const color = user.color ?? "#888";
    const name  = user.name  ?? "?";

    const caret = document.createElement("span");
    caret.classList.add("collaboration-cursor__caret");
    caret.style.borderColor = color;

    const label = document.createElement("span");
    label.classList.add("collaboration-cursor__label");
    label.style.backgroundColor = color;
    label.textContent = name;

    caret.appendChild(label);
    return caret;
}

export const CollaborationCursorExtension = Extension.create({
    name: "collaborationCursor",

    addProseMirrorPlugins() {
        return [
            yCursorPlugin(awareness, {
                cursorBuilder: buildCursor,
            }),
        ];
    },
});
