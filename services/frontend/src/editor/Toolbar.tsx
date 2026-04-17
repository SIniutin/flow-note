import {memo} from "react";
import type {Editor} from "@tiptap/react";
import {IconButton, Tooltip} from "../components/ui/controls";
import {useEditorState} from "./useEditorState";
import {useToolbarRef} from "./ToolbarRefContext";

interface Props {
    editor: Editor | null;
    onInsertImage: () => void;
    onAddComment: () => void;
}

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Проверяет, есть ли в текущем выделении хотя бы один блочный узел
 * указанного типа с заданными атрибутами.
 *
 * editor.isActive() работает «все-или-ничего» для блочных узлов:
 * при выделении двух H1 возвращает false, потому что технически
 * курсор не находится внутри одного конкретного heading-узла.
 * Этот хелпер обходит диапазон from→to через doc.nodesBetween.
 */
function selectionHasNode(
    editor: Editor,
    typeName: string,
    attrs?: Record<string, unknown>,
): boolean {
    const {from, to} = editor.state.selection;
    let found = false;
    editor.state.doc.nodesBetween(from, to, node => {
        if (found) return false; // прерываем обход
        if (node.type.name !== typeName) return true; // продолжаем вглубь
        if (!attrs) {
            found = true;
            return false;
        }
        const matches = Object.entries(attrs).every(
            ([k, v]) => node.attrs[k] === v,
        );
        if (matches) found = true;
        return false;
    });
    return found;
}

/**
 * Для марок (bold / italic / strike) стандартный editor.isActive()
 * подходит — он проверяет, есть ли марка на позиции курсора.
 * Но при смешанном выделении «жирный + обычный» тоже хочется подсвечивать.
 * Используем то же doc.nodesBetween, только для inline-марок.
 */
function selectionHasMark(editor: Editor, markName: string): boolean {
    // Точечный курсор — достаточно стандартной проверки
    if (editor.state.selection.empty) {
        return editor.isActive(markName);
    }
    const {from, to} = editor.state.selection;
    const markType = editor.state.schema.marks[markName];
    if (!markType) return false;
    let found = false;
    editor.state.doc.nodesBetween(from, to, node => {
        if (found) return false;
        if (markType.isInSet(node.marks)) found = true;
        return true;
    });
    return found;
}

// ── component ─────────────────────────────────────────────────────────────────

export const EditorToolbar = memo(function EditorToolbar({editor, onInsertImage, onAddComment}: Props) {
    useEditorState(editor);
    const toolbarRef = useToolbarRef();

    if (!editor) return null;

    const run = (fn: (c: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) =>
        fn(editor.chain().focus()).run();

    const btn = (
        label: string, tip: string, icon: React.ReactNode,
        isActive: boolean, onClick: () => void, disabled = false,
    ) => (
        // side="bottom" — тултип появляется под кнопкой, а не над ней.
        // При side="top" тултип выходит за верхний край вьюпорта и обрезается.
        <Tooltip content={tip} side="bottom">
            <span onMouseDown={e => e.preventDefault()}>
                <IconButton label={label} active={isActive} onClick={onClick} disabled={disabled}>
                    {icon}
                </IconButton>
            </span>
        </Tooltip>
    );

    const divider = (
        <span style={{width: 1, height: 16, background: "var(--border-default)", margin: "0 4px"}}/>
    );

    const hasSelection = !editor.state.selection.empty;

    return (
        <div
            ref={el => toolbarRef?.set(el)}
            style={{display: "flex", alignItems: "center", gap: "var(--space-1)", flex: 1, minWidth: 0}}
        >
            {btn("Bold", "Полужирный", <b>B</b>, selectionHasMark(editor, "bold"), () => run(c => c.toggleBold()))}
            {btn("Italic", "Курсив", <i>I</i>, selectionHasMark(editor, "italic"), () => run(c => c.toggleItalic()))}
            {btn("Strike", "Зачёркнутый",
                <s>S</s>, selectionHasMark(editor, "strike"), () => run(c => c.toggleStrike()))}
            {divider}
            {btn("H1", "Заголовок 1", "H1", selectionHasNode(editor, "heading", {level: 1}), () => run(c => c.toggleHeading({level: 1})))}
            {btn("H2", "Заголовок 2", "H2", selectionHasNode(editor, "heading", {level: 2}), () => run(c => c.toggleHeading({level: 2})))}
            {btn("List", "Список", "•", selectionHasNode(editor, "bulletList"), () => run(c => c.toggleBulletList()))}
            {btn("Quote", "Цитата", "\"", selectionHasNode(editor, "blockquote"), () => run(c => c.toggleBlockquote()))}
            {btn("Code", "Блок кода", "</>", selectionHasNode(editor, "codeBlock"), () => run(c => c.toggleCodeBlock()))}
            {divider}
            {btn("Comment", "Добавить комментарий", "💬", false, onAddComment, !hasSelection)}
            <span style={{flex: 1}}/>
            {btn("Undo", "Отменить", "↶", false, () => run(c => c.undo()))}
            {btn("Redo", "Повторить", "↷", false, () => run(c => c.redo()))}
            {btn("Image", "Вставить изображение", "🖼", false, onInsertImage)}
        </div>
    );
});