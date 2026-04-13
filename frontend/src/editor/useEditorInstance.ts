// ─── src/editor/useEditorInstance.ts ─────────────────────────────────────────

import {useMemo} from "react";
import {useEditor} from "@tiptap/react";
import {createEditorExtensions, initialContent} from "./extensions";
import {loadDoc} from "./persistence/storage";
import {ydoc} from "./collab/collabProvider";
import type {User} from "../data/users";

export function useEditorInstance(currentUser: User) {
    // createEditorExtensions уже обновляет awareness внутри себя
    const extensions = useMemo(
        () => createEditorExtensions(currentUser),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [currentUser.id],
    );

    return useEditor({
        extensions,
        content: "",

        onCreate({editor}) {
            // Ждём 250 мс — даём BroadcastChannel время прислать
            // содержимое от другой вкладки.
            setTimeout(() => {
                if (editor.isDestroyed) return;
                const fragment = ydoc.getXmlFragment("default");
                if (fragment.length === 0) {
                    const saved = loadDoc() ?? initialContent;
                    editor.commands.setContent(saved);
                }
            }, 250);
        },
    });
}