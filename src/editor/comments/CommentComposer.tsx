import { useState, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { Popover } from "../../components/ui/Popover";
import { Button } from "../../components/ui/controls";
import { Input } from "../../components/ui/forms";
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

    useEffect(() => { if (!open) setText(""); }, [open]);

    const submit = () => {
        if (!editor || !text.trim()) return;
        const id = newThreadId();
        editor.chain().focus().setCommentMark(id).run();
        addThread(text.trim(), currentUser.name, currentUser.id, id);
        onClose();
        setText("");
    };

    return (
        <Popover open={open && !!anchor} onClose={onClose} anchor={anchor} placement="top">
            <div style={{ display: "flex", gap: 8, padding: 8, minWidth: 280 }}
                 onMouseDown={e => e.stopPropagation()}>
                <Input
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