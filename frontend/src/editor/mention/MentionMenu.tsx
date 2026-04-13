import { Popover } from "../../components/ui/Popover";
import { fetchUsers } from "../../data/users";
import { useMentionState, mentionStore } from "./mentionStore";
import { Avatar } from "../../components/ui/layout";
import "./mentionMenu.css";

export function MentionMenu() {
    const { open, query, clientRect, editor, range, selectedIndex } = useMentionState();
    const items = fetchUsers(query);

    const anchor = clientRect
        ? { getBoundingClientRect: () => clientRect() ?? new DOMRect() }
        : null;

    const pick = (i: number) => {
        const user = items[i];
        if (user && editor && range) {
            editor
                .chain()
                .focus()
                .deleteRange(range)
                .insertContent([
                    { type: "mention", attrs: { userId: user.id } },
                    { type: "text", text: " " },
                ])
                .run();
        }
        mentionStore.reset();
    };

    return (
        <Popover open={open && items.length > 0} onClose={() => mentionStore.reset()} anchor={anchor}>
            <ul className="mention-menu">
                {items.map((user, i) => (
                    <li
                        key={user.id}
                        className={`mention-menu__item${i === selectedIndex ? " is-active" : ""}`}
                        onMouseDown={(e) => { e.preventDefault(); pick(i); }}
                        onMouseEnter={() => mentionStore.set({ selectedIndex: i })}
                    >
                        <Avatar name={user.name} colorIndex={user.colorIndex} size={28} />
                        <span className="mention-menu__text">
                            <span className="mention-menu__name">{user.name}</span>
                            {user.role && <span className="mention-menu__role">{user.role}</span>}
                        </span>
                    </li>
                ))}
            </ul>
        </Popover>
    );
}