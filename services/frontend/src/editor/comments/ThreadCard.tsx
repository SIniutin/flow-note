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

export const ThreadCard = memo(function ThreadCard({thread, colorIndex, active, onSelect}: Props) {
    const {addReply, resolveThread} = useComments();
    const currentUser = useCurrentUser();
    const [replyText, setReplyText] = useState("");

    const submitReply = () => {
        if (!replyText.trim()) return;
        addReply(thread.id, replyText, currentUser.name, currentUser.id);
        setReplyText("");
    };

    const resolveAuthorName = (authorId: string | undefined, fallback: string): string =>
        getUserById(authorId)?.name ?? fallback;

    const actionLinkStyle: React.CSSProperties = {
        cursor: "pointer",
        fontSize: "var(--fs-xs)",
        color: "var(--accent)",
    };

    return (
        <div
            onClick={onSelect}
            style={{
                cursor: "pointer",
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
                {thread.replies.map(r => (
                    <div key={r.id}>
                        <Comment
                            author={resolveAuthorName(r.authorId, r.author)}
                            date={r.createdAt}
                            text={r.text}
                            colorIndex={colorIndex}
                        />
                    </div>
                ))}
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

            {!thread.resolved && (
                <div style={{paddingLeft: 12, marginBottom: 8}}>
                    <span
                        style={actionLinkStyle}
                        onClick={e => {
                            e.stopPropagation();
                            resolveThread(thread.id);
                        }}
                    >
                        Отметить решённым
                    </span>
                </div>
            )}
        </div>
    );
});
