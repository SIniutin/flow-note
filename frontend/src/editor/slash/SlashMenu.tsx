import { Popover } from "../../components/ui/Popover";
import { filterCommands } from "./commands";
import { useSlashState, slashStore } from "./slashStore";
import "./slashMenu.css";

export function SlashMenu() {
    const { open, query, clientRect, editor, range, selectedIndex } = useSlashState();
    const items = filterCommands(query);

    const anchor = clientRect ? { getBoundingClientRect: () => clientRect() ?? new DOMRect() } : null;

    const pick = (i: number) => {
        const item = items[i];
        if (item && editor && range) item.run(editor, range);
        slashStore.reset();
    };

    return (
        <Popover open={open && items.length > 0} onClose={() => slashStore.reset()} anchor={anchor}>
            <ul className="slash-menu">
                {items.map((item, i) => (
                    <li
                        key={item.title}
                        className={`slash-menu__item${i === selectedIndex ? " is-active" : ""}`}
                        onMouseDown={(e) => { e.preventDefault(); pick(i); }}
                        onMouseEnter={() => slashStore.set({ selectedIndex: i })}
                    >
                        <span className="slash-menu__icon">{item.icon}</span>
                        <span className="slash-menu__text">
                            <span className="slash-menu__title">{item.title}</span>
                            <span className="slash-menu__desc">{item.description}</span>
                        </span>
                    </li>
                ))}
            </ul>
        </Popover>
    );
}