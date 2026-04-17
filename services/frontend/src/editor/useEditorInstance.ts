// ─── src/editor/useEditorInstance.ts ─────────────────────────────────────────

import {useEffect, useMemo} from "react";
import {useEditor} from "@tiptap/react";
import {createEditorExtensions, initialContent} from "./extensions";
import {loadDoc} from "./persistence/storage";
import * as collabProvider from "./collab/collabProvider";
import type {EditorUser} from "../data/useCurrentUser";

// Максимальное время ожидания sync-события от collab-сервера.
// Если за это время сервер не ответил (оффлайн, нет auth, DEV_BYPASS),
// проверяем документ и вставляем начальный контент самостоятельно.
const SYNC_FALLBACK_MS = 4000;

export function useEditorInstance(currentUser: EditorUser, pageId?: string) {
    // createEditorExtensions читает ydoc / awareness через live binding —
    // при смене страницы (connectCollab + key={pageId}) получает свежий ydoc.
    const extensions = useMemo(
        () => createEditorExtensions(currentUser, pageId),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [currentUser.id, pageId],   // пересоздаём при смене страницы
    );

    // Передаём [pageId] в useEditor — TipTap уничтожает и пересоздаёт редактор
    // при смене страницы, подхватывая новый ydoc из connectCollab().
    const editor = useEditor({ extensions, content: "" }, [pageId]);

    useEffect(() => {
        if (!editor) return;

        // Проверяем: документ реально пуст на сервере?
        // Вставляем контент только ПОСЛЕ того как сервер прислал свой стейт.
        // Это предотвращает дублирование: без этого 300ms-таймер мог сработать
        // раньше sync, вставить HTML из localStorage, а затем Yjs-merge добавлял
        // серверный контент поверх → документ «раздваивался».
        const tryInit = () => {
            if (editor.isDestroyed) return;
            const fragment = collabProvider.ydoc.getXmlFragment("default");
            if (fragment.length === 0) {
                // Документ действительно пуст на сервере — вставляем локальный
                // кэш или стартовый контент.
                const saved = loadDoc(pageId) ?? initialContent;
                editor.commands.setContent(saved);
            }
        };

        const onSynced = () => {
            cleanup();
            tryInit();
        };

        const fallbackTimer = window.setTimeout(() => {
            cleanup();
            tryInit();
        }, SYNC_FALLBACK_MS);

        const cleanup = () => {
            window.removeEventListener("collab:synced", onSynced);
            window.clearTimeout(fallbackTimer);
        };

        window.addEventListener("collab:synced", onSynced);

        return cleanup;
    }, [editor, pageId]); // eslint-disable-line react-hooks/exhaustive-deps

    return editor;
}
