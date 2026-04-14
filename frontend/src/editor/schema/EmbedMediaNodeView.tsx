import { useCallback, useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

const ICONS: Record<string, string> = { video: "🎬", audio: "🎵", file: "📎", embed: "🔗" };

export function EmbedMediaNodeView({ node, selected, updateAttributes }: NodeViewProps) {
    const { kind, src, alt, width, title, file_name } = node.attrs;

    const [liveWidth, setLiveWidth] = useState<number | null>(null);
    const [resizing, setResizing] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const startX = useRef(0);
    const startW = useRef(0);

    const onResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        startX.current = e.clientX;
        startW.current = wrapRef.current?.offsetWidth ?? (width ?? 400);
        setResizing(true);

        const onMove = (ev: MouseEvent) => {
            const w = Math.max(80, startW.current + ev.clientX - startX.current);
            setLiveWidth(w);
        };
        const onUp = (ev: MouseEvent) => {
            const w = Math.max(80, startW.current + ev.clientX - startX.current);
            updateAttributes({ width: Math.round(w) });
            setLiveWidth(null);
            setResizing(false);
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }, [width, updateAttributes]);

    if (kind === "image" || !kind) {
        const displayWidth = liveWidth ?? width ?? undefined;
        return (
            <NodeViewWrapper as="figure" className="embed-media embed-media--image">
                <div
                    ref={wrapRef}
                    className={`em-wrap${selected ? " is-selected" : ""}${resizing ? " is-resizing" : ""}`}
                    style={displayWidth ? { width: displayWidth, maxWidth: "100%" } : undefined}
                >
                    <img src={src} alt={alt ?? ""} draggable={false} />
                    {selected && (
                        <div className="em-handle" onMouseDown={onResizeStart} title="Resize">
                            <span className="em-handle__bar" />
                        </div>
                    )}
                </div>
            </NodeViewWrapper>
        );
    }

    return (
        <NodeViewWrapper as="div" className={`embed-media embed-media--${kind}`}>
            {ICONS[kind] ?? "📄"} {title ?? file_name ?? kind}
        </NodeViewWrapper>
    );
}
