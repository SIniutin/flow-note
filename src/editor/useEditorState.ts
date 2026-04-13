import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";

export function useEditorState(editor: Editor | null) {
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!editor) return;
        const rerender = () => setTick(t => t + 1);
        editor.on("update", rerender);
        editor.on("selectionUpdate", rerender);
        return () => {
            editor.off("update", rerender);
            editor.off("selectionUpdate", rerender);
        };
    }, [editor]);
}