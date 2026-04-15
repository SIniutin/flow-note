import {useState, useEffect, useRef, useCallback, useMemo} from "react";
import * as Y from "yjs";
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
import {useCurrentUser} from "./data/useCurrentUser";
import {useAuth} from "./data/authStore";
import {ToolbarRefContext, type ToolbarRefHandle} from "./editor/ToolbarRefContext";
import {TablePickerModal} from "./editor/mwsTable/TablePickerModal";
import {PresenceAvatars} from "./editor/collab/PresenceAvatars";
import {EmojiPickerPopover} from "./editor/emoji/EmojiPickerPopover";
import {Sidebar} from "./components/Sidebar";
import {BacklinksPanel} from "./components/BacklinksPanel";
import {SharePanel} from "./components/SharePanel";
import {pagesStore, useCurrentPage} from "./data/pagesStore";
import {pageClient} from "./api/pageClient";
import {pageUsersStore} from "./data/pageUsersStore";
import * as collabProvider from "./editor/collab/collabProvider";
import { usePageMeta, setPageMeta } from "./editor/collab/collabProvider";
import {VersionHistory} from "./editor/history/VersionHistory";
import {VersionPreviewOverlay} from "./editor/history/VersionPreviewOverlay";
import {useIncomingLinks} from "./data/pagelinksStore";
import {PagePickerModal} from "./editor/schema/PagePickerModal";
import {EditorContextMenu} from "./editor/ContextMenu";
import {PageGraph} from "./components/PageGraph";

import "./components/sidebar.css";

/** Deterministic 1-4 color index from a thread ID so avatar colors never shift. */
function stableColorIndex(id: string): 1 | 2 | 3 | 4 {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return ((h % 4) + 1) as 1 | 2 | 3 | 4;
}

export default function App() {
    const [loading, setLoading] = useState(true);
    const [imgOpen, setImgOpen] = useState(false);
    const [stickerOpen, setStickerOpen] = useState(false);
    const [rightPanel, setRightPanel] = useState<"comments" | "history" | "backlinks" | "share" | "graph" | null>("comments");
    const [composerOpen, setComposerOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<Y.Doc | null>(null);
    const [previewLabel, setPreviewLabel] = useState("");

    // ── Страница ──────────────────────────────────────────────────────────────
    const currentPage = useCurrentPage();
    const pageId = currentPage?.id ?? "";

    // Синхронно (до useEditorInstance) переключаем collab-провайдер при смене страницы.
    // useEffect здесь не подходит — он запускается ПОСЛЕ render, а useEditorInstance
    // читает ydoc/awareness уже во время render.
    // Пропускаем, если страниц ещё нет (pageId пустой).
    const prevPageIdRef = useRef<string | null>(null);
    if (pageId && prevPageIdRef.current !== pageId) {
        prevPageIdRef.current = pageId;
        collabProvider.connectCollab(pageId);
    }

    // При первом монтировании: загружаем список страниц с бэкенда.
    useEffect(() => {
        void pagesStore.loadFromBackend();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Счётчик для принудительного обновления данных (роль, список страниц).
    // Инкрементируется при возврате на вкладку — без перезагрузки страницы.
    const [refreshKey, setRefreshKey] = useState(0);

    // Обновляем список страниц и роль при возврате на вкладку.
    // Это позволяет гrantee увидеть новые доступные страницы и изменения роли
    // без перезагрузки страницы.
    useEffect(() => {
        const handler = () => {
            if (document.visibilityState === "visible") {
                void pagesStore.loadFromBackend();
                setRefreshKey(k => k + 1);
            }
        };
        document.addEventListener("visibilitychange", handler);
        return () => document.removeEventListener("visibilitychange", handler);
    }, []);

    // При смене страницы: загружаем пользователей с доступом (для @ mention).
    useEffect(() => {
        if (!pageId) return;
        pageUsersStore.reset(pageId);
        void pageUsersStore.load(pageId);
    }, [pageId]);

    // После автообновления JWT-токена переподключаем page-провайдер без ремонта редактора.
    useEffect(() => {
        if (!pageId) return;
        const handler = () => { collabProvider.reconnectPageProvider(pageId); };
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
    const { user, logout: authLogout } = useAuth();

    // ── Роль текущего пользователя для текущей страницы ───────────────────────
    // null = ещё не определена (загрузка). «owner»/«editor»/«mentor» = можно редактировать.
    const [myRole, setMyRole] = useState<string | null>(null);

    useEffect(() => {
        setMyRole(null); // сброс при смене страницы
        if (!pageId || !user?.id) return;

        // Владелец всегда может редактировать — проверяем синхронно.
        if (currentPage?.ownerId === user.id) {
            setMyRole("owner");
            return;
        }

        let cancelled = false;
        pageClient.getMyPermission(pageId)
            .then(({ permission }) => {
                if (cancelled) return;
                setMyRole(permission.role);
            })
            .catch(() => { if (!cancelled) setMyRole("viewer"); });

        return () => { cancelled = true; };
    }, [pageId, user?.id, currentPage?.ownerId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

    /** Может ли текущий пользователь редактировать содержимое. */
    const canEdit = ((): boolean => {
        if (!myRole) return true; // пока роль не загружена — не блокируем
        // Приводим как короткий формат («editor»), так и proto-формат («PAGE_PERMISSION_ROLE_EDITOR»)
        const r = myRole.startsWith("PAGE_PERMISSION_ROLE_")
            ? myRole.slice("PAGE_PERMISSION_ROLE_".length).toLowerCase()
            : myRole.toLowerCase();
        return r === "owner" || r === "editor" || r === "mentor";
    })();

    // key={pageId} заставляет TipTap пересоздаться при смене страницы
    // (подхватывает новый ydoc из connectCollab)
    const editor = useEditorInstance(currentUser, pageId || undefined);

    // Применяем editability к TipTap-редактору при изменении роли.
    // editor объявлен выше — эффект идёт после декларации.
    useEffect(() => {
        if (!editor) return;
        editor.setEditable(canEdit, false);
    }, [editor, canEdit]); // eslint-disable-line react-hooks/exhaustive-deps
    const {
        threads, visibleThreads, activeThreadId, setActiveThreadId, setOrphanedIds, removeThread,
    } = useComments();

    const saveStatus = useSaveStatus(editor, pageId);
    const incomingLinksCount = useIncomingLinks(pageId).length;

    // Живой заголовок и описание из ydoc — обновляются у всех участников в реальном времени.
    // Fallback на данные из REST (pagesStore) пока ydoc ещё не синхронизировался.
    const pageMeta = usePageMeta(pageId);
    const liveTitle       = pageMeta.title       ?? currentPage?.title;
    const liveDescription = pageMeta.description ?? currentPage?.description;

    // При первом синке ydoc из S3-снапшота (и при изменениях от других клиентов)
    // пробрасываем актуальные метаданные в pagesStore → сайдбар показывает свежий title.
    // Пропускаем, если нет активной страницы.
    useEffect(() => {
        if (pageId && pageMeta.title !== null) pagesStore.updateTitle(pageId, pageMeta.title);
    }, [pageMeta.title, pageId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (pageId && pageMeta.description !== null) pagesStore.updateDescription(pageId, pageMeta.description);
    }, [pageMeta.description, pageId]); // eslint-disable-line react-hooks/exhaustive-deps

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
        (src: string, mimeType: string, fileName: string, mediaId?: string) => {
            if (!editor) return;
            editor.chain().focus().insertEmbedMedia({
                kind:     "image",
                // Если есть media_id — не храним base64 в Yjs-документе.
                // EmbedMediaNodeView запросит presigned download URL по media_id.
                src:      mediaId ? null : (src || null),
                media_id: mediaId ?? null,
                mime_type: mimeType,
                file_name: fileName,
                alt:      fileName,
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


    // ── Toolbar / tabs / panels ───────────────────────────────────────────────
    const toolbar = (
        <EditorToolbar editor={editor} onInsertImage={handleInsertImage} onAddComment={handleAddComment}/>
    );

    const tabs = (
        <>
            <PresenceAvatars/>
            <span style={{fontSize:"var(--fs-sm)",color:"var(--text-secondary)"}}>
                {user?.login ?? user?.email ?? ""}
            </span>
            <a style={{cursor:"pointer",color:"var(--text-tertiary)",fontSize:"var(--fs-sm)"}}
               onClick={() => {
                   // Рвём WebSocket-соединение ДО очистки токена —
                   // иначе awareness остаётся у других участников.
                   collabProvider.disconnectCollab();
                   void authLogout();
               }}>
                Выйти
            </a>

            <a style={{cursor:"pointer", color: rightPanel==="comments" ? "var(--accent)" : undefined}}
               onClick={() => setRightPanel(p => p === "comments" ? null : "comments")}>
                💬 Комментарии
            </a>
            <a style={{cursor:"pointer", color: rightPanel==="backlinks" ? "var(--accent)" : undefined}}
               onClick={() => setRightPanel(p => p === "backlinks" ? null : "backlinks")}>
                🔗 Ссылки {incomingLinksCount > 0 && `(${incomingLinksCount})`}
            </a>
            <a style={{cursor:"pointer", color: rightPanel==="history" ? "var(--accent)" : undefined}}
               onClick={() => setRightPanel(p => p === "history" ? null : "history")}>
                🕐 История
            </a>
            <a style={{cursor:"pointer", color: rightPanel==="share" ? "var(--accent)" : undefined}}
               onClick={() => setRightPanel(p => p === "share" ? null : "share")}>
                👥 Доступ
            </a>
            <a style={{cursor:"pointer", color: rightPanel==="graph" ? "var(--accent)" : undefined}}
               onClick={() => setRightPanel(p => p === "graph" ? null : "graph")}>
                🗺 Граф
            </a>
            <a style={{cursor:"pointer", color:"var(--text-tertiary)"}}
               onClick={() => {
                   if (!window.confirm("Сбросить документ? Всё содержимое страницы будет удалено на сервере и восстановлению не подлежит.")) return;
                   clearAll(pageId);
                   editor?.commands.clearContent(false);
                   setTimeout(() => window.location.reload(), 500);
               }}>
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
                {visibleThreads.map((t) => (
                    <ThreadCard
                        key={t.id} thread={t}
                        colorIndex={stableColorIndex(t.id)}
                        active={activeThreadId === t.id}
                        onSelect={() => handleThreadSelect(t.id)}
                        onDelete={() => handleDeleteThread(t.id)}
                    />
                ))}
            </SidePanel>
        );
    } else if (rightPanel === "backlinks") {
        sidePanel = (
            <BacklinksPanel
                pageId={pageId}
                onNavigate={handleNavigate}
                onClose={() => setRightPanel(null)}
            />
        );
    } else if (rightPanel === "history") {
        sidePanel = (
            <VersionHistory
                pageId={pageId}
                onClose={() => setRightPanel(null)}
                onPreview={(doc, label) => { setPreviewDoc(doc); setPreviewLabel(label); }}
            />
        );
    } else if (rightPanel === "share") {
        sidePanel = (
            <SharePanel
                pageId={pageId}
                onClose={() => setRightPanel(null)}
            />
        );
    } else if (rightPanel === "graph") {
        sidePanel = (
            <PageGraph
                pageId={pageId}
                onNavigate={handleNavigate}
                onClose={() => setRightPanel(null)}
            />
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
                    {!currentPage ? (
                        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-tertiary)",fontSize:"var(--fs-sm)"}}>
                            Нет страниц. Создайте первую страницу в боковой панели.
                        </div>
                    ) : (
                        <PageShell
                            toolbar={toolbar}
                            rightTabs={tabs}
                            sidePanel={sidePanel}
                            footer={<EditorFooter editor={editor} saveStatus={saveStatus}/>}
                            title={liveTitle}
                            description={liveDescription}
                            icon={currentPage.icon}
                            onTitleChange={canEdit ? title => {
                                setPageMeta("title", title);
                                pagesStore.updateTitle(currentPage.id, title);
                                // Сохраняем в page-service чтобы новые участники
                                // видели актуальный заголовок до загрузки collab-документа.
                                pageClient.update(currentPage.id, { title }).catch(() => {});
                            } : undefined}
                            onDescriptionChange={canEdit ? desc => {
                                setPageMeta("description", desc);
                                pagesStore.updateDescription(currentPage.id, desc);
                                pageClient.update(currentPage.id, { description: desc }).catch(() => {});
                            } : undefined}
                        >
                            {loading
                                ? <PageSkeleton/>
                                : <EditorContent key={pageId} editor={editor}/>
                            }
                        </PageShell>
                    )}
                </div>
            </div>

            <ImageModal open={imgOpen} onClose={handleImageModalClose} onApply={handleImageApply} pageId={pageId}/>
            <ImageModal open={stickerOpen} onClose={handleStickerModalClose} onApply={handleImageApply} pageId={pageId} title="Вставить стикер"/>
            <EmojiPickerPopover/>
            <SlashMenu/>
            <MentionMenu/>
            <TablePickerModal/>
            <PagePickerModal/>
            <EditorContextMenu editor={editor} onAddComment={handleAddComment}/>
            <CommentComposer editor={editor} open={composerOpen} onClose={() => setComposerOpen(false)}/>
            {previewDoc && (
                <VersionPreviewOverlay
                    doc={previewDoc}
                    label={previewLabel}
                    onClose={() => setPreviewDoc(null)}
                />
            )}
        </ToolbarRefContext.Provider>
    );
}
