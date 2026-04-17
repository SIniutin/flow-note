import type { Editor, Range } from "@tiptap/core";
import { useEffect, useState } from "react";

interface EmojiPickerState {
    open: boolean;
    editor: Editor | null;
    range: Range | null;
    anchor: { getBoundingClientRect: () => DOMRect } | null;
}

const initial: EmojiPickerState = { open: false, editor: null, range: null, anchor: null };
let state = initial;
const listeners = new Set<() => void>();

export const emojiPickerStore = {
    get: () => state,
    open: (editor: Editor, range: Range) => {
        // get position BEFORE deleting the slash text
        let anchor: EmojiPickerState["anchor"] = null;
        try {
            const coords = editor.view.coordsAtPos(range.from);
            const rect = new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top);
            anchor = { getBoundingClientRect: () => rect };
        } catch { /* ignore */ }
        if (!anchor) {
            const rect = new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0);
            anchor = { getBoundingClientRect: () => rect };
        }
        // delete the slash text immediately so the suggestion plugin exits cleanly
        editor.chain().focus().deleteRange(range).run();
        state = { open: true, editor, range: null, anchor };
        listeners.forEach(l => l());
    },
    reset: () => { state = initial; listeners.forEach(l => l()); },
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useEmojiPickerState() {
    const [, setTick] = useState(0);
    useEffect(() => emojiPickerStore.subscribe(() => setTick(t => t + 1)), []);
    return emojiPickerStore.get();
}
