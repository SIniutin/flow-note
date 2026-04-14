import type { Editor, Range } from "@tiptap/core";
import { mwsTableCommand } from "../mwsTable/mwsTableCommand";
import { emojiPickerStore } from "../emoji/emojiPickerStore";

export interface SlashCommand {
    title: string;
    description: string;
    icon: string;
    keywords: string[];
    run: (editor: Editor, range: Range) => void;
}

export const slashCommands: SlashCommand[] = [
    {
        title: "Заголовок 1", description: "Крупный заголовок", icon: "H1",
        keywords: ["h1", "heading", "заголовок"],
        run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 1 }).run(),
    },
    {
        title: "Заголовок 2", description: "Средний заголовок", icon: "H2",
        keywords: ["h2", "heading", "заголовок"],
        run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 2 }).run(),
    },
    {
        title: "Список", description: "Маркированный список", icon: "•",
        keywords: ["list", "bullet", "список"],
        run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
    },
    {
        title: "Цитата", description: "Блок цитаты", icon: "\u201C",
        keywords: ["quote", "blockquote", "цитата"],
        run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
    },
    {
        title: "Код", description: "Блок кода", icon: "</>",
        keywords: ["code", "код"],
        run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run(),
    },
    {
        title: "Оглавление",
        description: "Автоматическое содержание из заголовков",
        icon: "☰",
        keywords: ["toc", "contents", "оглавление", "содержание", "навигация"],
        run: (e, r) => e.chain().focus().deleteRange(r).insertTableOfContents().run(),
    },
    {
        title: "Эмодзи",
        description: "Вставить эмодзи из пикера",
        icon: "😊",
        keywords: ["emoji", "эмодзи", "смайл", "smile"],
        run: (e, r) => emojiPickerStore.open(e, r),
    },
    mwsTableCommand,
    {
        title: "Изображение",
        description: "Вставить изображение или медиафайл",
        icon: "🖼",
        keywords: ["image", "изображение", "фото", "картинка", "embed", "media"],
        run: (e, r) => {
            e.chain().focus().deleteRange(r).run();
            window.dispatchEvent(new CustomEvent("wiki:open-image-modal"));
        },
    },
    {
        title: "Стикер",
        description: "Вставить стикер",
        icon: "🎭",
        keywords: ["sticker", "стикер", "gif", "анимация"],
        run: (e, r) => {
            e.chain().focus().deleteRange(r).run();
            window.dispatchEvent(new CustomEvent("wiki:open-sticker-modal"));
        },
    },
];

export function filterCommands(query: string): SlashCommand[] {
    const q = query.trim().toLowerCase();
    if (!q) return slashCommands;
    return slashCommands.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.keywords.some(k => k.includes(q)),
    );
}
