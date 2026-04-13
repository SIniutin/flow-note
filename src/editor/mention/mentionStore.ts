import type { Editor, Range } from "@tiptap/core";
import { useEffect, useState } from "react";

export interface MentionState {
    open: boolean;
    query: string;
    clientRect: (() => DOMRect | null) | null;
    editor: Editor | null;
    range: Range | null;
    selectedIndex: number;
}

const initial: MentionState = {
    open: false, query: "", clientRect: null, editor: null, range: null, selectedIndex: 0,
};

let state: MentionState = initial;
const listeners = new Set<() => void>();

export const mentionStore = {
    get: () => state,
    set: (patch: Partial<MentionState>) => {
        state = { ...state, ...patch };
        listeners.forEach(l => l());
    },
    reset: () => { state = initial; listeners.forEach(l => l()); },
    subscribe: (l: () => void) => {
        listeners.add(l);
        return () => { listeners.delete(l); };
    },
};

export function useMentionState(): MentionState {
    const [, setTick] = useState(0);
    useEffect(() => {
        return mentionStore.subscribe(() => setTick(t => t + 1));
    }, []);
    return mentionStore.get();
}