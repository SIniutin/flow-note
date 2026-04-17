import { Popover } from "../../components/ui/Popover";
import { pageUsersStore, type PageUser } from "../../data/pageUsersStore";
import { useMentionState, mentionStore } from "./mentionStore";
import "./mentionMenu.css";

export function MentionMenu() {
    const { open, query, clientRect, editor, range, selectedIndex } = useMentionState();
    const items = pageUsersStore.filter(query);
    const loading = pageUsersStore.isLoading();

    const anchor = clientRect
        ? { getBoundingClientRect: () => clientRect() ?? new DOMRect() }
        : null;

    const pick = (user: PageUser) => {
        if (editor && range) {
            editor
                .chain()
                .focus()
                .deleteRange(range)
                .insertContent([
                    { type: "mention", attrs: { id: user.id, label: user.login, kind: "user" } },
                    { type: "text", text: " " },
                ])
                .run();
        }
        mentionStore.reset();
    };

    return (
        <Popover open={open && (items.length > 0 || loading)} onClose={() => mentionStore.reset()} anchor={anchor}>
            <ul className="mention-menu">
                {loading && (
                    <li className="mention-menu__item" style={{color:"var(--text-tertiary)",fontSize:"var(--fs-xs)"}}>
                        Загрузка…
                    </li>
                )}
                {items.map((user, i) => (
                    <li
                        key={user.id}
                        className={`mention-menu__item${i === selectedIndex ? " is-active" : ""}`}
                        onMouseDown={(e) => { e.preventDefault(); pick(user); }}
                        onMouseEnter={() => mentionStore.set({ selectedIndex: i })}
                    >
                        <span className="mention-menu__text">
                            <span className="mention-menu__name">{user.login}</span>
                            <span className="mention-menu__role">{user.email}</span>
                        </span>
                    </li>
                ))}
            </ul>
        </Popover>
    );
}
