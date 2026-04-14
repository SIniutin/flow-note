import { useCallback, useEffect, useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { mediaClient } from "../../api/mediaClient";
import { pagesStore } from "../../data/pagesStore";

const ICONS: Record<string, string> = { video: "🎬", audio: "🎵", file: "📎", embed: "🔗" };

// ── Image with media_id ───────────────────────────────────────────────────────
// Fetches a fresh presigned S3 download URL on mount.
// Falls back to src (base64 or plain URL) if no media_id.

function MediaImage({
    mediaId, pageId, src, alt, width, selected,
    onResizeStart,
}: {
    mediaId: string | null;
    pageId:  string | null;
    src:     string | null;
    alt:     string | null;
    width:   number | null;
    selected: boolean;
    onResizeStart: (e: React.MouseEvent) => void;
}) {
    const [resolvedSrc, setResolvedSrc] = useState<string | null>(src ?? null);

    useEffect(() => {
        if (!mediaId || !pageId) return;
        let cancelled = false;
        mediaClient.getDownloadUrl(pageId, mediaId)
            .then(url => { if (!cancelled) setResolvedSrc(url); })
            .catch(() => { /* keep existing src if any */ });
        return () => { cancelled = true; };
    }, [mediaId, pageId]);

    // Re-fetch if presigned URL expires (img onerror)
    const handleError = useCallback(() => {
        if (!mediaId || !pageId) return;
        mediaClient.getDownloadUrl(pageId, mediaId)
            .then(url => setResolvedSrc(url))
            .catch(() => {});
    }, [mediaId, pageId]);

    return (
        <>
            {resolvedSrc
                ? <img src={resolvedSrc} alt={alt ?? ""} draggable={false} onError={handleError} />
                : <div style={{ width: "100%", height: 80, background: "var(--bg-muted, #f3f4f6)", borderRadius: 4 }} />
            }
            {selected && (
                <div className="em-handle" onMouseDown={onResizeStart} title="Resize">
                    <span className="em-handle__bar" />
                </div>
            )}
        </>
    );
}

// ── main component ────────────────────────────────────────────────────────────

export function EmbedMediaNodeView({ node, selected, updateAttributes }: NodeViewProps) {
    const { kind, src, alt, width, title, file_name, media_id } = node.attrs;
    // pageId берём из pagesStore — media_id всегда принадлежит текущей странице.
    const pageId = pagesStore.getCurrentId();

    const [liveWidth, setLiveWidth] = useState<number | null>(null);
    const [resizing, setResizing]   = useState(false);
    const wrapRef  = useRef<HTMLDivElement>(null);
    const startX   = useRef(0);
    const startW   = useRef(0);

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
                    <MediaImage
                        mediaId={media_id ?? null}
                        pageId={pageId ?? null}
                        src={src ?? null}
                        alt={alt ?? null}
                        width={width ?? null}
                        selected={selected}
                        onResizeStart={onResizeStart}
                    />
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
