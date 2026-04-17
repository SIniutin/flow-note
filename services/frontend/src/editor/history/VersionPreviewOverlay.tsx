// ─── src/editor/history/VersionPreviewOverlay.tsx ────────────────────────────
// Полноэкранный оверлей для просмотра старой версии страницы (только чтение).

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import * as Y from "yjs";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";

import { BlockIdExtension }         from "../schema/BlockIdExtension";
import { EmbedMediaExtension }      from "../schema/EmbedMediaExtension";
import { PageLinkExtension }        from "../schema/PageLinkExtension";
import { MediaInlineExtension }     from "../schema/MediaInlineExtension";
import { TableOfContentsExtension } from "../schema/TableOfContentsExtension";
import { CommentMark }              from "../comments/CommentMark";
import { MentionNode }              from "../mention/MentionNode";
import { MwsTableExtension }        from "../mwsTable/MwsTableExtension";
import "../editor.css";
import "./versionPreviewOverlay.css";

interface VersionPreviewOverlayProps {
    doc:     Y.Doc;
    label:   string;   // Человекочитаемый заголовок версии
    onClose: () => void;
}

/** Минимальный набор расширений для корректного рендера схемы без интерактива. */
function createPreviewExtensions(doc: Y.Doc) {
    return [
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: doc }),
        BlockIdExtension,
        EmbedMediaExtension,
        PageLinkExtension.configure({ pageId: "" }),
        MediaInlineExtension,
        TableOfContentsExtension,
        CommentMark,
        MentionNode,
        MwsTableExtension,
    ];
}

export function VersionPreviewOverlay({ doc, label, onClose }: VersionPreviewOverlayProps) {
    const editor = useEditor({
        extensions: createPreviewExtensions(doc),
        editable:   false,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doc]);

    // Destroy temp Y.Doc when overlay closes
    useEffect(() => {
        return () => { doc.destroy(); };
    }, [doc]);

    // Close on Escape
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    return (
        <div className="vpo__backdrop" onClick={onClose}>
            <div className="vpo__panel" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="vpo__head">
                    <div className="vpo__head-left">
                        <span className="vpo__badge">Только просмотр</span>
                        <span className="vpo__label">{label}</span>
                    </div>
                    <button className="vpo__close" onClick={onClose} title="Закрыть (Esc)">
                        <IconClose/>
                    </button>
                </div>
                {/* Read-only editor */}
                <div className="vpo__body">
                    <div className="vpo__editor ProseMirror-wrapper">
                        {editor
                            ? <EditorContent editor={editor}/>
                            : <div className="vpo__loading">Загрузка…</div>
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}

function IconClose() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="3" x2="13" y2="13"/>
            <line x1="13" y1="3" x2="3" y2="13"/>
        </svg>
    );
}
