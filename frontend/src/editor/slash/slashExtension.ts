import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { slashStore } from "./slashStore";
import { filterCommands } from "./commands";

export const SlashExtension = Extension.create({
    name: "slashCommand",
    addOptions() {
        return {
            suggestion: {
                char: "/",
                startOfLine: false,
                command: ({ editor, range, props }) => {
                    (props as { run: (e: typeof editor, r: typeof range) => void }).run(editor, range);
                },
            } as Partial<SuggestionOptions>,
        };
    },
    addProseMirrorPlugins() {
        return [
            Suggestion({
                pluginKey: new PluginKey("slashSuggestion"),
                editor: this.editor,
                ...this.options.suggestion,
                items: ({ query }) => filterCommands(query),
                render: () => ({
                    onStart: (props) => {
                        slashStore.set({
                            open: true, query: props.query, clientRect: props.clientRect ?? null,
                            editor: props.editor, range: props.range, selectedIndex: 0,
                        });
                    },
                    onUpdate: (props) => {
                        slashStore.set({
                            query: props.query, clientRect: props.clientRect ?? null,
                            range: props.range, selectedIndex: 0,
                        });
                    },
                    onKeyDown: (props) => {
                        const s = slashStore.get();
                        const items = filterCommands(s.query);
                        if (props.event.key === "ArrowDown") {
                            slashStore.set({ selectedIndex: (s.selectedIndex + 1) % Math.max(items.length, 1) });
                            return true;
                        }
                        if (props.event.key === "ArrowUp") {
                            slashStore.set({ selectedIndex: (s.selectedIndex - 1 + items.length) % Math.max(items.length, 1) });
                            return true;
                        }
                        if (props.event.key === "Enter") {
                            const item = items[s.selectedIndex];
                            if (item && s.editor && s.range) item.run(s.editor, s.range);
                            slashStore.reset();
                            return true;
                        }
                        if (props.event.key === "Escape") { slashStore.reset(); return true; }
                        return false;
                    },
                    onExit: () => slashStore.reset(),
                }),
            }),
        ];
    },
});