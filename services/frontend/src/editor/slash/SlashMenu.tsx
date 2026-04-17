import { useEffect, useRef } from "react";
import { Popover } from "../../components/ui/Popover";
import { filterCommands } from "./commands";
import { useSlashState, slashStore } from "./slashStore";
import "./slashMenu.css";

export function SlashMenu() {
    const { open, query, clientRect, editor, range, selectedIndex } = useSlashState();
    const items = filterCommands(query);

    const listRef        = useRef<HTMLUListElement>(null);
    // После программного скролла (по стрелке) запрещаем hover менять индекс
    // до тех пор, пока пользователь реально не двинет мышь.
    // mousemove от реального движения мыши срабатывает,
    // а mouseenter от «элемент уехал под курсор при скролле» — не даёт mousemove.
    const hoverLockRef   = useRef(false);

    useEffect(() => {
        const list = listRef.current;
        if (!list) return;
        const el = list.children[selectedIndex] as HTMLElement | undefined;
        if (!el) return;

        const listTop    = list.scrollTop;
        const listBottom = listTop + list.clientHeight;
        const elTop      = el.offsetTop;
        const elBottom   = elTop + el.offsetHeight;

        if (elBottom > listBottom) {
            hoverLockRef.current = true;
            list.scrollTop = elBottom - list.clientHeight;
        } else if (elTop < listTop) {
            hoverLockRef.current = true;
            list.scrollTop = elTop;
        }
    }, [selectedIndex]);

    const anchor = clientRect ? { getBoundingClientRect: () => clientRect() ?? new DOMRect() } : null;

    const pick = (i: number) => {
        const item = items[i];
        if (item && editor && range) item.run(editor, range);
        slashStore.reset();
    };

    return (
        <Popover open={open && items.length > 0} onClose={() => slashStore.reset()} anchor={anchor}>
            <ul
                className="slash-menu"
                ref={listRef}
                // Реальное движение мыши снимает блокировку hover
                onMouseMove={() => { hoverLockRef.current = false; }}
            >
                {items.map((item, i) => (
                    <li
                        key={item.title}
                        className={`slash-menu__item${i === selectedIndex ? " is-active" : ""}`}
                        onMouseDown={(e) => { e.preventDefault(); pick(i); }}
                        onMouseEnter={() => {
                            if (!hoverLockRef.current) slashStore.set({ selectedIndex: i });
                        }}
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