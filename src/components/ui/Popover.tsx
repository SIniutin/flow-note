import { useEffect, useRef, type ReactNode } from "react";
import {
    useFloating, autoUpdate, offset, flip, shift,
    type Placement, type ReferenceType,
} from "@floating-ui/react";
import { useToolbarRef } from "../../editor/ToolbarRefContext";
import "./popover.css";

interface PopoverProps {
    open: boolean;
    onClose: () => void;
    anchor: ReferenceType | null;
    placement?: Placement;
    children: ReactNode;
}

export function Popover({ open, onClose, anchor, placement = "bottom-start", children }: PopoverProps) {
    const { refs, floatingStyles } = useFloating({
        open, placement,
        middleware: [offset(6), flip(), shift({ padding: 8 })],
        whileElementsMounted: autoUpdate,
    });

    useEffect(() => { refs.setReference(anchor); }, [anchor, refs]);

    const floatingRef = useRef<HTMLDivElement | null>(null);
    const toolbarRef = useToolbarRef();

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (floatingRef.current?.contains(target)) return;
            const toolbarEl = toolbarRef?.get();
            if (toolbarEl?.contains(target)) return;
            onClose();
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open, onClose, toolbarRef]);

    if (!open || !anchor) return null;

    return (
        <div
            ref={(el) => { floatingRef.current = el; refs.setFloating(el); }}
            style={floatingStyles}
            className="ui-popover"
            role="dialog"
        >
            {children}
        </div>
    );
}