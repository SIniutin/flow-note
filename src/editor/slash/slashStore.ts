import type {Editor, Range} from "@tiptap/core";
import {useEffect, useState} from "react";

export interface SlashState {
    open: boolean;
    query: string;
    clientRect: (() => DOMRect | null) | null;
    editor: Editor | null;
    range: Range | null;
    selectedIndex: number;
}

const initial: SlashState = {
    open: false, query: "", clientRect: null, editor: null, range: null, selectedIndex: 0,
};

let state: SlashState = initial;
const listeners = new Set<() => void>();

export const slashStore = {
    get: () => state,
    set: (patch: Partial<SlashState>) => {
        state = {...state, ...patch};
        listeners.forEach(l => l());
    },
    reset: () => {
        state = initial;
        listeners.forEach(l => l());
    },
    subscribe: (l: () => void) => {
        listeners.add(l);
        return () => {
            listeners.delete(l);
        };
    },
};

export function useSlashState(): SlashState {
    const [, setTick] = useState(0);
    useEffect(() => {
        return slashStore.subscribe(() => setTick(t => t + 1));
    }, []);
    return slashStore.get();
}