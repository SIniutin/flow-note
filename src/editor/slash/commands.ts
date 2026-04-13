import type { Editor, Range } from "@tiptap/core";
import { mwsTableCommand } from "../mwsTable/mwsTableCommand";

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
    mwsTableCommand,
];

export function filterCommands(query: string): SlashCommand[] {
    const q = query.trim().toLowerCase();
    if (!q) return slashCommands;
    return slashCommands.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.keywords.some(k => k.includes(q)),
    );
}