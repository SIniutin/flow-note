import {memo, useState} from "react";
import {Comment} from "../../components/ui/layout";
import {Button} from "../../components/ui/controls";
import {Input} from "../../components/ui/forms";
import {useComments} from "./useComments";
import type {Thread} from "./commentsCtx";
import {getUserById} from "../../data/users";
import {useCurrentUser} from "../../data/useCurrentUser";

interface Props {
    thread: Thread;
    colorIndex: 1 | 2 | 3 | 4;
    active: boolean;
    onSelect: () => void;
    onDelete: () => void;
}

export const ThreadCard = memo(function ThreadCard({thread, colorIndex, active, onSelect, onDelete}: Props) {
    const {addReply, resolveThread, removeReply} = useComments();
    const currentUser = useCurrentUser();
    const [replyText, setReplyText] = useState("");

    const submitReply = () => {
        if (!replyText.trim()) return;
        addReply(thread.id, replyText, currentUser.name, currentUser.id);
        setReplyText("");
    };

    const resolveAuthorName = (authorId: string | undefined, fallback: string): string =>
        getUserById(authorId)?.name ?? fallback;

    const canDeleteThread = !thread.authorId || thread.authorId === currentUser.id;

    const actionLinkStyle: React.CSSProperties = {
        cursor: "pointer",
        fontSize: "var(--fs-xs)",
        color: "var(--accent)",
    };
    const dangerLinkStyle: React.CSSProperties = {
        cursor: "pointer",
        fontSize: "var(--fs-xs)",
        color: "var(--text-tertiary)",
        marginLeft: 12,
    };

    return (
        <div
            onClick={onSelect}
            style={{
                cursor: "pointer",
                // box-shadow вместо outline — не обрезается overflow:hidden родителя
                boxShadow: active ? "0 0 0 2px var(--accent)" : "none",
                borderRadius: "var(--radius-sm)",
                marginBottom: 8,
            }}
        >
            <Comment
                author={resolveAuthorName(thread.authorId, thread.author)}
                date={thread.createdAt}
                text={thread.text}
                resolved={thread.resolved}
                colorIndex={colorIndex}
            >
                {thread.replies.map(r => {
                    const canDeleteReply = !r.authorId || r.authorId === currentUser.id;
                    return (
                        <div key={r.id}>
                            <Comment
                                author={resolveAuthorName(r.authorId, r.author)}
                                date={r.createdAt}
                                text={r.text}
                                colorIndex={colorIndex}
                            />
                            {canDeleteReply && (
                                <div style={{paddingLeft: 36, marginTop: -4, marginBottom: 4}}>
                                    <span
                                        style={dangerLinkStyle}
                                        onClick={e => {
                                            e.stopPropagation();
                                            removeReply(thread.id, r.id);
                                        }}
                                    >
                                        Удалить
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </Comment>

            {!thread.resolved && (
                <div
                    style={{display: "flex", gap: 6, marginTop: 4, marginBottom: 8, padding: "0 8px"}}
                    onClick={e => e.stopPropagation()}
                >
                    <Input
                        value={replyText}
                        placeholder="Ответить…"
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === "Enter") submitReply();
                        }}
                    />
                    <Button disabled={!replyText.trim()} onClick={submitReply}>OK</Button>
                </div>
            )}

            <div style={{paddingLeft: 12, marginBottom: 8}}>
                {!thread.resolved && (
                    <span
                        style={actionLinkStyle}
                        onClick={e => {
                            e.stopPropagation();
                            resolveThread(thread.id);
                        }}
                    >
                        Отметить решённым
                    </span>
                )}
                {canDeleteThread && (
                    <span
                        style={dangerLinkStyle}
                        onClick={e => {
                            e.stopPropagation();
                            if (confirm("Удалить комментарий и все ответы?")) onDelete();
                        }}
                    >
                        Удалить
                    </span>
                )}
            </div>
        </div>
    );
});