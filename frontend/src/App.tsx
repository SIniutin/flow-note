import {useState, useEffect, useRef, useCallback, useMemo} from "react";
import {EditorContent} from "@tiptap/react";
import {SidePanel} from "./components/ui/surfaces";
import {PageShell, PageSkeleton} from "./components/ui/layout";
import {EditorToolbar} from "./editor/Toolbar";
import {EditorFooter} from "./editor/EditorFooter";
import {useEditorInstance} from "./editor/useEditorInstance";
import {ImageModal} from "./components/ImageModal";
import "./editor/editor.css";
import {SlashMenu} from "./editor/slash/SlashMenu";
import {useComments} from "./editor/comments/useComments";
import {CommentComposer} from "./editor/comments/CommentComposer";
import {ThreadCard} from "./editor/comments/ThreadCard";
import {findThreadRange} from "./editor/comments/findThreadRange";
import {clearAll} from "./editor/persistence/storage";
import {useSaveStatus} from "./editor/persistence/useSaveStatus";
import {MentionMenu} from "./editor/mention/MentionMenu";
import {getAllUsers} from "./data/users";
import {useCurrentUser, changeCurrentUser} from "./data/useCurrentUser";
import {ToolbarRefContext, type ToolbarRefHandle} from "./editor/ToolbarRefContext";
import {TablePickerModal} from "./editor/mwsTable/TablePickerModal";
import {PresenceAvatars} from "./editor/collab/PresenceAvatars";
import {EmojiPickerPopover} from "./editor/emoji/EmojiPickerPopover";

export default function App() {
    const [loading, setLoading] = useState(true);
    const [imgOpen, setImgOpen] = useState(false);
    const [stickerOpen, setStickerOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(true);
    const [composerOpen, setComposerOpen] = useState(false);

    const toolbarElRef = useRef<HTMLElement | null>(null);
    const toolbarRefHandle = useMemo<ToolbarRefHandle>(() => ({
        set: (el) => {
            toolbarElRef.current = el;
        },
        get: () => toolbarElRef.current,
    }), []);

    useEffect(() => {
        const t = setTimeout(() => setLoading(false), 1500);
        return () => clearTimeout(t);
    }, []);

    const currentUser = useCurrentUser();
    const editor = useEditorInstance(currentUser);
    const {
        threads, visibleThreads, activeThreadId, setActiveThreadId, setOrphanedIds, removeThread,
    } = useComments();

    const saveStatus = useSaveStatus(editor);

    // ── Клики по comment-маркам в редакторе ─────────────────────────────────
    useEffect(() => {
        if (!editor) return;
        let dom: HTMLElement | null = null;
        const onClick = (e: MouseEvent) => {
            const el = (e.target as HTMLElement).closest("[data-thread-id]") as HTMLElement | null;
            if (el) {
                setActiveThreadId(el.getAttribute("data-thread-id"));
                setHistoryOpen(true);
            } else {
                // Клик в редактор НЕ на comment-марку → снимаем активный тред
                setActiveThreadId(null);
            }
        };
        const attach = () => {
            if (editor.isDestroyed) return;
            try {
                dom = editor.view.dom as HTMLElement;
                dom.addEventListener("click", onClick);
            } catch { /* view не готов */ }
        };
        editor.on("create", attach);
        attach();
        return () => {
            editor.off("create", attach);
            if (dom) dom.removeEventListener("click", onClick);
        };
    }, [editor, setActiveThreadId]);

    useEffect(() => {
        if (!editor) return;
        const sync = () => {
            const orphans = new Set<string>();
            for (const t of threads) {
                if (findThreadRange(editor, t.id) === null) orphans.add(t.id);
            }
            setOrphanedIds(orphans);
        };
        sync();
        editor.on("update", sync);
        return () => {
            editor.off("update", sync);
        };
    }, [editor, threads, setOrphanedIds]);

    useEffect(() => {
        if (!editor) return;
        const handler = () => {
            if (editor.state.selection.empty) setComposerOpen(false);
        };
        editor.on("selectionUpdate", handler);
        return () => {
            editor.off("selectionUpdate", handler);
        };
    }, [editor]);

    // ── Снятие активного треда при клике вне боковой панели ─────────────────
    const sidePanelRef = useRef<HTMLElement | null>(null);
    useEffect(() => {
        if (!activeThreadId) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            // Не сбрасываем если клик внутри боковой панели или на comment-марке
            if (sidePanelRef.current?.contains(target)) return;
            if ((target as HTMLElement).closest?.("[data-thread-id]")) return;
            setActiveThreadId(null);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [activeThreadId, setActiveThreadId]);

    const handleInsertImage = useCallback(() => setImgOpen(true), []);

    useEffect(() => {
        const handler = () => setImgOpen(true);
        window.addEventListener("wiki:open-image-modal", handler);
        return () => window.removeEventListener("wiki:open-image-modal", handler);
    }, []);

    useEffect(() => {
        const handler = () => setStickerOpen(true);
        window.addEventListener("wiki:open-sticker-modal", handler);
        return () => window.removeEventListener("wiki:open-sticker-modal", handler);
    }, []);

    const handleImageModalClose = useCallback(() => {
        setImgOpen(false);
        setTimeout(() => editor?.commands.focus(), 50);
    }, [editor]);

    const handleStickerModalClose = useCallback(() => {
        setStickerOpen(false);
        setTimeout(() => editor?.commands.focus(), 50);
    }, [editor]);

    const handleImageApply = useCallback(
        (base64: string, mimeType: string, fileName: string) => {
            if (!editor) return;
            editor.chain()
                .focus()
                .insertEmbedMedia({
                    kind:      "image",
                    src:       base64,
                    mime_type: mimeType,
                    file_name: fileName,
                    alt:       fileName,
                })
                .run();
        },
        [editor],
    );

    const handleAddComment = useCallback(() => {
        if (!editor) return;
        if (editor.state.selection.empty) return;
        setComposerOpen(o => !o);
    }, [editor]);

    const handleDeleteThread = useCallback((threadId: string) => {
        if (!editor) return;
        editor.chain().focus().unsetCommentMark(threadId).run();
        removeThread(threadId);
    }, [editor, removeThread]);

    const handleThreadSelect = useCallback((threadId: string) => {
        setActiveThreadId(threadId);
        if (!editor) return;
        const range = findThreadRange(editor, threadId);
        if (!range) return;

        // Устанавливаем выделение текста
        editor.chain().focus().setTextSelection(range).run();

        // TipTap's scrollIntoView() не работает с кастомным scroll-контейнером
        // (.ui-shell__content). Используем нативный DOM scrollIntoView.
        requestAnimationFrame(() => {
            try {
                const domPos = editor.view.domAtPos(range.from);
                const node = domPos.node instanceof Element
                    ? domPos.node
                    : domPos.node.parentElement;
                node?.scrollIntoView({ behavior: "smooth", block: "center" });
            } catch { /* view мог разрушиться */ }
        });
    }, [editor, setActiveThreadId]);

    const toolbar = (
        <EditorToolbar
            editor={editor}
            onInsertImage={handleInsertImage}
            onAddComment={handleAddComment}
        />
    );

    const tabs = (
        <>
            <PresenceAvatars />
            <select
                value={currentUser.id}
                onChange={e => changeCurrentUser(e.target.value)}
                style={{
                    fontSize: "var(--fs-sm)",
                    padding: "2px 6px",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                }}
                onClick={e => e.stopPropagation()}
            >
                {getAllUsers().map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                ))}
            </select>
            <a style={{cursor: "pointer", color: "var(--accent)"}}
               onClick={() => setHistoryOpen(o => !o)}>Комментарии</a>
            <a style={{cursor: "pointer"}}>Машина времени</a>
            <a style={{cursor: "pointer", color: "var(--text-tertiary)"}}
               onClick={() => {
                   clearAll();
                   window.location.reload();
               }}>Сбросить</a>
        </>
    );

    const sidePanel = historyOpen && (
        <SidePanel open onClose={() => setHistoryOpen(false)} title="История комментариев"
                   subtitle={`Всего тредов: ${visibleThreads.length}`}
                   ref={sidePanelRef}>
            {visibleThreads.length === 0 && (
                <div style={{color: "var(--text-tertiary)", fontSize: "var(--fs-sm)", padding: "var(--space-3) 0"}}>
                    Выделите текст в документе и нажмите 💬, чтобы оставить комментарий.
                </div>
            )}
            {visibleThreads.map((t, i) => (
                <ThreadCard
                    key={t.id}
                    thread={t}
                    colorIndex={((i % 4) + 1) as 1 | 2 | 3 | 4}
                    active={activeThreadId === t.id}
                    onSelect={() => handleThreadSelect(t.id)}
                    onDelete={() => handleDeleteThread(t.id)}
                />
            ))}
        </SidePanel>
    );

    return (
        <ToolbarRefContext.Provider value={toolbarRefHandle}>
            <PageShell toolbar={toolbar} rightTabs={tabs} sidePanel={sidePanel}
                       footer={<EditorFooter editor={editor} saveStatus={saveStatus}/>}>
                {loading ? <PageSkeleton/> : <EditorContent editor={editor}/>}
            </PageShell>
            <ImageModal open={imgOpen} onClose={handleImageModalClose} onApply={handleImageApply}/>
            <ImageModal open={stickerOpen} onClose={handleStickerModalClose} onApply={handleImageApply} title="Вставить стикер"/>
            <EmojiPickerPopover/>
            <SlashMenu/>
            <MentionMenu/>
            <TablePickerModal/>
            <CommentComposer
                editor={editor}
                open={composerOpen}
                onClose={() => setComposerOpen(false)}
            />
        </ToolbarRefContext.Provider>
    );
}