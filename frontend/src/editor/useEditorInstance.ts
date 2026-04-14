// ─── src/editor/useEditorInstance.ts ─────────────────────────────────────────

import {useMemo} from "react";
import {useEditor} from "@tiptap/react";
import {createEditorExtensions, initialContent} from "./extensions";
import {loadDoc} from "./persistence/storage";
import {ydoc} from "./collab/collabProvider";
import type {User} from "../data/users";

export function useEditorInstance(currentUser: User, pageId?: string) {
    // createEditorExtensions читает ydoc / awareness через live binding —
    // при смене страницы (connectCollab + key={pageId}) получает свежий ydoc.
    const extensions = useMemo(
        () => createEditorExtensions(currentUser),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [currentUser.id, pageId],   // пересоздаём при смене страницы
    );

    return useEditor({
        extensions,
        content: "",

        onCreate({editor}) {
            // Ждём 300 мс — даём Hocuspocus загрузить документ с сервера.
            setTimeout(() => {
                if (editor.isDestroyed) return;
                const fragment = ydoc.getXmlFragment("default");
                if (fragment.length === 0) {
                    // Новый документ: загружаем локальный кэш или начальный контент
                    const saved = loadDoc(pageId) ?? initialContent;
                    editor.commands.setContent(saved);
                }
            }, 300);
        },
    });
}

// Yjs import для проверки fragment.length
import * as Y from "yjs";
