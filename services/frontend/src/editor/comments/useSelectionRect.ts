import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { ReferenceType } from "@floating-ui/react";

export function useSelectionRect(editor: Editor | null): ReferenceType | null {
    const [anchor, setAnchor] = useState<ReferenceType | null>(null);

    useEffect(() => {
        if (!editor) return;
        const update = () => {
            const { from, to, empty } = editor.state.selection;
            if (empty) { setAnchor(null); return; }
            setAnchor({
                getBoundingClientRect: () => {
                    const a = editor.view.coordsAtPos(from);
                    const b = editor.view.coordsAtPos(to);
                    const left = Math.min(a.left, b.left);
                    const right = Math.max(a.right, b.right);
                    const top = Math.min(a.top, b.top);
                    const bottom = Math.max(a.bottom, b.bottom);
                    return new DOMRect(left, top, right - left, bottom - top);
                },
            });
        };
        editor.on("selectionUpdate", update);
        editor.on("update", update);
        return () => { editor.off("selectionUpdate", update); editor.off("update", update); };
    }, [editor]);

    return anchor;
}