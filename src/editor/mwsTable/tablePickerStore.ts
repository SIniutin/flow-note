// ─── src/editor/mwsTable/tablePickerStore.ts ──────────────────────────────────
// Мини-стор для состояния модального пикера таблиц.
// Паттерн один-в-один с slashStore.ts и mentionStore.ts.

import { useEffect, useState } from "react";
import type { Editor, Range } from "@tiptap/core";

export interface TablePickerState {
    open: boolean;
    editor: Editor | null;
    range: Range | null;
}

const initial: TablePickerState = {
    open: false,
    editor: null,
    range: null,
};

let state: TablePickerState = initial;
const listeners = new Set<() => void>();

export const tablePickerStore = {
    get: () => state,
    set: (patch: Partial<TablePickerState>) => {
        state = { ...state, ...patch };
        listeners.forEach(l => l());
    },
    open: (editor: Editor, range: Range) => {
        state = { open: true, editor, range };
        listeners.forEach(l => l());
    },
    reset: () => {
        state = initial;
        listeners.forEach(l => l());
    },
    subscribe: (l: () => void) => {
        listeners.add(l);
        return () => { listeners.delete(l); };
    },
};

export function useTablePickerState(): TablePickerState {
    const [, setTick] = useState(0);
    useEffect(() => tablePickerStore.subscribe(() => setTick(t => t + 1)), []);
    return tablePickerStore.get();
}
