import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { mentionStore } from "./mentionStore";
import { fetchUsers } from "../../data/users";

export const MentionExtension = Extension.create({
    name: "mentionSuggestion",
    addOptions() {
        return {
            suggestion: {
                char: "@",
                startOfLine: false,
                command: ({ editor, range, props }) => {
                    const userId = (props as { id: string }).id;
                    editor
                        .chain()
                        .focus()
                        .deleteRange(range)
                        .insertContent([
                            { type: "mention", attrs: { userId } },
                            { type: "text", text: " " },
                        ])
                        .run();
                },
            } as Partial<SuggestionOptions>,
        };
    },
    addProseMirrorPlugins() {
        return [
            Suggestion({
                pluginKey: new PluginKey("mentionSuggestion"),
                editor: this.editor,
                ...this.options.suggestion,
                items: ({ query }) => fetchUsers(query),
                render: () => ({
                    onStart: (props) => {
                        mentionStore.set({
                            open: true, query: props.query, clientRect: props.clientRect ?? null,
                            editor: props.editor, range: props.range, selectedIndex: 0,
                        });
                    },
                    onUpdate: (props) => {
                        mentionStore.set({
                            query: props.query, clientRect: props.clientRect ?? null,
                            range: props.range, selectedIndex: 0,
                        });
                    },
                    onKeyDown: (props) => {
                        const s = mentionStore.get();
                        const items = fetchUsers(s.query);
                        if (props.event.key === "ArrowDown") {
                            mentionStore.set({ selectedIndex: (s.selectedIndex + 1) % Math.max(items.length, 1) });
                            return true;
                        }
                        if (props.event.key === "ArrowUp") {
                            mentionStore.set({ selectedIndex: (s.selectedIndex - 1 + items.length) % Math.max(items.length, 1) });
                            return true;
                        }
                        if (props.event.key === "Enter") {
                            const item = items[s.selectedIndex];
                            if (item && s.editor && s.range) {
                                s.editor
                                    .chain()
                                    .focus()
                                    .deleteRange(s.range)
                                    .insertContent([
                                        { type: "mention", attrs: { userId: item.id } },
                                        { type: "text", text: " " },
                                    ])
                                    .run();
                            }
                            mentionStore.reset();
                            return true;
                        }
                        if (props.event.key === "Escape") { mentionStore.reset(); return true; }
                        return false;
                    },
                    onExit: () => mentionStore.reset(),
                }),
            }),
        ];
    },
});