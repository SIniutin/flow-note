// ─── src/editor/EditorFooter.tsx ─────────────────────────────────────────────

import { memo } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "./useEditorState";
import type { SaveStatus } from "./persistence/useSaveStatus";

interface Props {
    editor: Editor | null;
    saveStatus: SaveStatus;
}

const STATUS_CONFIG: Record<SaveStatus, { icon: string; label: string; color: string }> = {
    idle:   { icon: "",   label: "",              color: "transparent"           },
    saving: { icon: "⏳", label: "Сохраняю...",   color: "var(--text-tertiary)"  },
    saved:  { icon: "✓",  label: "Сохранено",     color: "var(--accent)"         },
    error:  { icon: "⚠️", label: "Ошибка записи", color: "var(--danger)"         },
};

export const EditorFooter = memo(function EditorFooter({ editor, saveStatus }: Props) {
    useEditorState(editor);
    if (!editor) return null;

    const { icon, label, color } = STATUS_CONFIG[saveStatus];

    return (
        <>
            {/* Статус автосохранения */}
            <span
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "var(--fs-xs)",
                    color,
                    transition: "color 0.2s, opacity 0.2s",
                    opacity: saveStatus === "idle" ? 0 : 1,
                    minWidth: 110,
                }}
                aria-live="polite"
            >
                {icon && <span>{icon}</span>}
                {label}
            </span>

            {/* Счётчик слов */}
            <span>
                {editor.storage.characterCount.words()} слов
                {" · "}
                {editor.storage.characterCount.characters()} символов
            </span>
        </>
    );
});
