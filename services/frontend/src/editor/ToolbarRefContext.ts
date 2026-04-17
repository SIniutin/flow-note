import { createContext, useContext } from "react";

export interface ToolbarRefHandle {
    set: (el: HTMLElement | null) => void;
    get: () => HTMLElement | null;
}

export const ToolbarRefContext = createContext<ToolbarRefHandle | null>(null);
export const useToolbarRef = () => useContext(ToolbarRefContext);