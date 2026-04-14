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
import {Sidebar} from "./components/Sidebar";
import {pagesStore, useCurrentPage} from "./data/pagesStore";
import * as collabProvider from "./editor/collab/collabProvider";
import {VersionHistory} from "./editor/history/VersionHistory";
import {historyStore} from "./editor/history/historyStore";
import {useIncomingLinks} from "./data/pagelinksStore";
import {PagePickerModal} from "./editor/schema/PagePickerModal";
import "./components/sidebar.css";

export default function App() {
    const [loading, setLoading] = useState(true);
    const [imgOpen, setImgOpen] = useState(false);
    const [stickerOpen, setStickerOpen] = useState(false);
    const [rightPanel, setRightPanel] = useState<"comments" | "history" | "backlinks" | null>("comments");
    const [composerOpen, setComposerOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // ── Страница ──────────────────────────────────────────────────────────────
    const currentPage = useCurrentPage();
    const pageId = currentPage?.id ?? "page-default";

    // Синхронно (до useEditorInstance) переключаем collab-провайдер при смене страницы.
    // useEffect здесь не подходит — он запускается ПОСЛЕ render, а useEditorInstance
    // читает ydoc/awareness уже во время render.
    const prevPageIdRef = useRef<string | null>(null);
    if (prevPageIdRef.current !== pageId) {
        prevPageIdRef.current = pageId;
        collabProvider.connectCollab(pageId);
    }

    // При первом монтировании: запускаем workspace-провайдер.
    useEffect(() => {
        collabProvider.initWorkspaceProvider(() => pagesStore.onWorkspaceSynced());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // После автообновления JWT-токена переподключаем провайдеры без ремонта редактора.
    useEffect(() => {
        const handler = () => {
            collabProvider.reconnectPageProvider(pageId);
            collabProvider.initWorkspaceProvider(() => pagesStore.onWorkspaceSynced());
        };
        window.addEventListener("auth:token-refreshed", handler);
        return () => window.removeEventListener("auth:token-refreshed", handler);
    }, [pageId]);

    // ── Toolbar ref ───────────────────────────────────────────────────────────
    const toolbarElRef = useRef<HTMLElement | null>(null);
    const toolbarRefHandle = useMemo<ToolbarRefHandle>(() => ({
        set: (el) => { toolbarElRef.current = el; },
        get: () => toolbarElRef.current,
    }), []);

    useEffect(() => {
        const t = setTimeout(() => setLoading(false), 800);
        return () => clearTimeout(t);
    }, []);

    const currentUser = useCurrentUser();
    // key={pageId} заставляет TipTap пересоздаться при смене страницы
    // (подхватывает новый ydoc из connectCollab)
    const editor = useEditorInstance(currentUser, pageId);
    const {
        threads, visibleThreads, activeThreadId, setActiveThreadId, setOrphanedIds, removeThread,
    } = useComments();

    const saveStatus = useSaveStatus(editor);
    const incomingLinks = useIncomingLinks(pageId);

    // ── Клики по comment-маркам ───────────────────────────────────────────────
    useEffect(() => {
        if (!editor) return;
        let dom: HTMLElement | null = null;
        const onClick = (e: MouseEvent) => {
            const el = (e.target as HTMLElement).closest("[data-thread-id]") as HTMLElement | null;
            if (el) {
                setActiveThreadId(el.getAttribute("data-thread-id"));
                setRightPanel("comments");
            } else {
                setActiveThreadId(null);
            }
        };
        const attach = () => {
            if (editor.isDestroyed) return;
            try { dom = editor.view.dom as HTMLElement; dom.addEventListener("click", onClick); }
            catch { /* view не готов */ }
        };
        editor.on("create", attach);
        attach();
        return () => { editor.off("create", attach); if (dom) dom.removeEventListener("click", onClick); };
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
        return () => { editor.off("update", sync); };
    }, [editor, threads, setOrphanedIds]);

    useEffect(() => {
        if (!editor) return;
        const handler = () => { if (editor.state.selection.empty) setComposerOpen(false); };
        editor.on("selectionUpdate", handler);
        return () => { editor.off("selectionUpdate", handler); };
    }, [editor]);

    // ── Клик вне боковой панели ───────────────────────────────────────────────
    const sidePanelRef = useRef<HTMLElement | null>(null);
    useEffect(() => {
        if (!activeThreadId) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (sidePanelRef.current?.contains(target)) return;
            if ((target as HTMLElement).closest?.("[data-thread-id]")) return;
            setActiveThreadId(null);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [activeThreadId, setActiveThreadId]);

    // ── Image / sticker modals ────────────────────────────────────────────────
    const handleInsertImage = useCallback(() => setImgOpen(true), []);
    useEffect(() => {
        const h = () => setImgOpen(true);
        window.addEventListener("wiki:open-image-modal", h);
        return () => window.removeEventListener("wiki:open-image-modal", h);
    }, []);
    useEffect(() => {
        const h = () => setStickerOpen(true);
        window.addEventListener("wiki:open-sticker-modal", h);
        return () => window.removeEventListener("wiki:open-sticker-modal", h);
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
            editor.chain().focus().insertEmbedMedia({
                kind: "image", src: base64, mime_type: mimeType,
                file_name: fileName, alt: fileName,
            }).run();
        }, [editor],
    );

    const handleAddComment = useCallback(() => {
        if (!editor || editor.state.selection.empty) return;
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
        editor.chain().focus().setTextSelection(range).run();
        requestAnimationFrame(() => {
            try {
                const domPos = editor.view.domAtPos(range.from);
                const node = domPos.node instanceof Element ? domPos.node : domPos.node.parentElement;
                node?.scrollIntoView({ behavior: "smooth", block: "center" });
            } catch { /* view мог разрушиться */ }
        });
    }, [editor, setActiveThreadId]);

    // ── Page navigation ───────────────────────────────────────────────────────
    const handleNavigate = useCallback((id: string) => {
        pagesStore.setCurrentId(id);
        setRightPanel("comments");
    }, []);

    // ── Snapshot ──────────────────────────────────────────────────────────────
    const handleCreateSnapshot = useCallback(() => {
        if (!currentPage) return;
        const label = prompt("Название версии:", `Версия ${new Date().toLocaleDateString("ru-RU")}`);
        if (label === null) return;
        historyStore.createSnapshot(pageId, collabProvider.ydoc, label || undefined);
    }, [pageId, currentPage]);

    // ── Toolbar / tabs / panels ───────────────────────────────────────────────
    const toolbar = (
        <EditorToolbar editor={editor} onInsertImage={handleInsertImage} onAddComment={handleAddComment}/>
    );

    const tabs = (
        <>
            <PresenceAvatars/>
            <select
                value={currentUser.id}
                onChange={e => changeCurrentUser(e.target.value)}
                style={{
                    fontSize: "var(--fs-sm)", padding: "2px 6px",
                    border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)",
                    background: "var(--bg-surface)", color: "var(--text-primary)", cursor: "pointer",
                }}
                onClick={e => e.stopPropagation()}
            >
                {getAllUsers().map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>

            <a style={{cursor:"pointer", color: rightPanel==="comments" ? "var(--accent)" : undefined}}
               onClick={() => setRightPanel(p => p === "comments" ? null : "comments")}>
                💬 Комментарии
            </a>
            <a style={{cursor:"pointer", color: rightPanel==="backlinks" ? "var(--accent)" : undefined}}
               onClick={() => setRightPanel(p => p === "backlinks" ? null : "backlinks")}>
                🔗 Ссылки {incomingLinks.length > 0 && `(${incomingLinks.length})`}
            </a>
            <a style={{cursor:"pointer", color: rightPanel==="history" ? "var(--accent)" : undefined}}
               onClick={() => setRightPanel(p => p === "history" ? null : "history")}>
                🕐 История
            </a>
            <a style={{cursor:"pointer", color:"var(--text-tertiary)"}}
               onClick={() => { clearAll(pageId); window.location.reload(); }}>
                Сбросить
            </a>
        </>
    );

    // ── Right side panel ──────────────────────────────────────────────────────
    let sidePanel: React.ReactNode = null;

    if (rightPanel === "comments") {
        sidePanel = (
            <SidePanel open onClose={() => setRightPanel(null)}
                       title="Комментарии"
                       subtitle={`Всего тредов: ${visibleThreads.length}`}
                       ref={sidePanelRef}>
                {visibleThreads.length === 0 && (
                    <div style={{color:"var(--text-tertiary)",fontSize:"var(--fs-sm)",padding:"var(--space-3) 0"}}>
                        Выделите текст и нажмите 💬 чтобы оставить комментарий.
                    </div>
                )}
                {visibleThreads.map((t, i) => (
                    <ThreadCard
                        key={t.id} thread={t}
                        colorIndex={((i % 4) + 1) as 1|2|3|4}
                        active={activeThreadId === t.id}
                        onSelect={() => handleThreadSelect(t.id)}
                        onDelete={() => handleDeleteThread(t.id)}
                    />
                ))}
            </SidePanel>
        );
    } else if (rightPanel === "backlinks") {
        sidePanel = (
            <SidePanel open onClose={() => setRightPanel(null)}
                       title="Обратные ссылки"
                       subtitle={`Страниц ссылается: ${incomingLinks.length}`}>
                {incomingLinks.length === 0 ? (
                    <div style={{color:"var(--text-tertiary)",fontSize:"var(--fs-sm)",padding:"var(--space-3) 0"}}>
                        Ни одна страница не ссылается на эту.
                        Используйте /страница в редакторе для вставки ссылок.
                    </div>
                ) : (
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {incomingLinks.map(link => (
                            <div key={link.id}
                                 onClick={() => handleNavigate(link.fromId)}
                                 style={{
                                     padding:"10px 12px",
                                     background:"var(--bg-surface)",
                                     borderRadius:"var(--radius-sm)",
                                     cursor:"pointer",
                                     border:"1px solid var(--border-default)",
                                     transition:"border-color 0.12s",
                                 }}
                                 onMouseEnter={e=>(e.currentTarget.style.borderColor="var(--accent)")}
                                 onMouseLeave={e=>(e.currentTarget.style.borderColor="var(--border-default)")}
                            >
                                <div style={{fontWeight:500,fontSize:"var(--fs-sm)",color:"var(--text-primary)"}}>
                                    📄 {link.fromTitle}
                                </div>
                                <div style={{fontSize:"var(--fs-xs)",color:"var(--text-tertiary)",marginTop:2}}>
                                    {new Date(link.createdAt).toLocaleDateString("ru-RU")}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SidePanel>
        );
    } else if (rightPanel === "history") {
        sidePanel = (
            <SidePanel open onClose={() => setRightPanel(null)} title="" subtitle="">
                <VersionHistory
                    pageId={pageId}
                    onCreateSnapshot={handleCreateSnapshot}
                    onClose={() => setRightPanel(null)}
                />
            </SidePanel>
        );
    }

    return (
        <ToolbarRefContext.Provider value={toolbarRefHandle}>
            <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>
                {/* Sidebar */}
                <Sidebar
                    currentPageId={pageId}
                    onNavigate={handleNavigate}
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed(c => !c)}
                />

                {/* Editor area */}
                <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
                    <PageShell toolbar={toolbar} rightTabs={tabs} sidePanel={sidePanel}
                               footer={<EditorFooter editor={editor} saveStatus={saveStatus}/>}>
                        {loading
                            ? <PageSkeleton/>
                            : <EditorContent key={pageId} editor={editor}/>
                        }
                    </PageShell>
                </div>
            </div>

            <ImageModal open={imgOpen} onClose={handleImageModalClose} onApply={handleImageApply}/>
            <ImageModal open={stickerOpen} onClose={handleStickerModalClose} onApply={handleImageApply} title="Вставить стикер"/>
            <EmojiPickerPopover/>
            <SlashMenu/>
            <MentionMenu/>
            <TablePickerModal/>
            <PagePickerModal/>
            <CommentComposer editor={editor} open={composerOpen} onClose={() => setComposerOpen(false)}/>
        </ToolbarRefContext.Provider>
    );
}
