import type { Editor } from "@tiptap/react";

export function findThreadRange(editor: Editor, threadId: string): { from: number; to: number } | null {
    let from: number | null = null;
    let to: number | null = null;
    editor.state.doc.descendants((node, pos) => {
        const mark = node.marks.find(
            m => m.type.name === "commentMark" && m.attrs.threadId === threadId,
        );
        if (mark) {
            if (from === null) from = pos;
            to = pos + node.nodeSize;
        }
    });
    return from !== null && to !== null ? { from, to } : null;
}