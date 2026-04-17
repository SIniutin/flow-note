import { useRef, useState, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { Popover } from "../../components/ui/Popover";
import { Button } from "../../components/ui/controls";
import { useComments } from "./useComments";
import { useSelectionRect } from "./useSelectionRect";
import { newThreadId } from "./id";
import { useCurrentUser } from "../../data/useCurrentUser";

interface Props {
    editor: Editor | null;
    open: boolean;
    onClose: () => void;
}

export function CommentComposer({ editor, open, onClose }: Props) {
    const anchor = useSelectionRect(editor);
    const { addThread } = useComments();
    const currentUser = useCurrentUser();
    const [text, setText] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    // Сохраняем диапазон выделения в момент открытия composer-а.
    // К моменту submit() редактор мог потерять фокус и selection сбросился.
    const savedRangeRef = useRef<{ from: number; to: number } | null>(null);

    useEffect(() => {
        if (open && editor && !editor.state.selection.empty) {
            const { from, to } = editor.state.selection;
            savedRangeRef.current = { from, to };
        } else if (!open) {
            savedRangeRef.current = null;
            setText("");
        }
    }, [open, editor]);

    // Автофокус при открытии
    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 50);
    }, [open]);

    const submit = () => {
        if (!editor || !text.trim()) return;
        const range = savedRangeRef.current;
        if (!range) return;
        const id = newThreadId();
        editor.chain().focus().setCommentMark(id, range.from, range.to).run();
        addThread(text.trim(), currentUser.name, currentUser.id, id);
        onClose();
    };

    return (
        <Popover open={open && !!anchor} onClose={onClose} anchor={anchor} placement="top">
            {/* Используем raw <input> вместо <Input> — div.ui-field-обёртка ломает
                flex-row layout: без flex:1 на ней браузер берёт intrinsic-width инпута
                и тень :focus вылезает на кнопку. */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, minWidth: 280 }}
                 onMouseDown={e => e.stopPropagation()}>
                <input
                    ref={inputRef}
                    className="ui-input"
                    style={{ flex: 1, minWidth: 0 }}
                    value={text}
                    placeholder="Оставить комментарий…"
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") submit(); }}
                />
                <Button disabled={!text.trim()} onClick={submit}>OK</Button>
            </div>
        </Popover>
    );
}