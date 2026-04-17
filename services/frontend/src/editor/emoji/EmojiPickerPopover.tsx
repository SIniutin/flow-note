import { useCallback, useEffect, useRef, useState } from "react";
import { Popover } from "../../components/ui/Popover";
import { emojiPickerStore, useEmojiPickerState } from "./emojiPickerStore";
import "./emojiPickerPopover.css";

// ── emoji data ────────────────────────────────────────────────────────────────

const SECTIONS: { label: string; emojis: string[] }[] = [
    {
        label: "Популярные",
        emojis: ["😀","😂","🥹","😊","😍","🤩","😎","🥰","😭","😤","🤔","🙏","🤯","😈","🥳","🤗"],
    },
    {
        label: "Жесты",
        emojis: ["👍","👎","👏","🙌","🤝","✌️","🤞","💪","🫶","☝️","🫵","🤙","👋","🖐️","🤜","🤛"],
    },
    {
        label: "Сердца",
        emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","❤️‍🔥","💕","💞","💓","💗","💖","✨"],
    },
    {
        label: "Природа",
        emojis: ["🌟","🌈","☀️","🌙","⚡","🌊","🌸","🌿","🍀","🦋","🐶","🐱","🦊","🐼","🌺","🌴"],
    },
    {
        label: "Объекты",
        emojis: ["🔥","💯","✅","❌","⚠️","📌","🏆","🥇","🎯","🎉","💡","🔗","🚀","💻","📚","🎨"],
    },
];

// flat list with search metadata (label is used for filtering)
const ALL: { emoji: string; label: string }[] = SECTIONS.flatMap(s =>
    s.emojis.map(e => ({ emoji: e, label: s.label.toLowerCase() })),
);

// ── component ─────────────────────────────────────────────────────────────────

export function EmojiPickerPopover() {
    const { open, editor, range, anchor } = useEmojiPickerState();
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setQuery("");
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [open]);

    const pick = useCallback((emoji: string) => {
        if (!editor) return;
        editor.chain().focus().insertEmoji(emoji).run();
        emojiPickerStore.reset();
    }, [editor]);

    const close = useCallback(() => emojiPickerStore.reset(), []);

    const q = query.trim().toLowerCase();
    const filtered = q
        ? ALL.filter(({ emoji, label }) => emoji.includes(q) || label.includes(q))
        : null;

    return (
        <Popover open={open} onClose={close} anchor={anchor} placement="bottom-start">
            <div className="ep-wrap">
                <input
                    ref={inputRef}
                    className="ep-search"
                    placeholder="Поиск…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    autoComplete="off"
                />
                <div className="ep-scroll">
                    {filtered ? (
                        filtered.length === 0
                            ? <div className="ep-empty">Ничего не найдено</div>
                            : <div className="ep-grid">
                                {filtered.map(({ emoji }, i) => (
                                    <button key={i} className="ep-btn" onMouseDown={e => { e.preventDefault(); pick(emoji); }}>
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                    ) : (
                        SECTIONS.map(s => (
                            <div key={s.label} className="ep-section">
                                <div className="ep-section__label">{s.label}</div>
                                <div className="ep-grid">
                                    {s.emojis.map((emoji, i) => (
                                        <button key={i} className="ep-btn" onMouseDown={e => { e.preventDefault(); pick(emoji); }}>
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Popover>
    );
}
