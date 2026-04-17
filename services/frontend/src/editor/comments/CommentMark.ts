import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Fragment, Slice, type Node as PMNode } from "@tiptap/pm/model";

export interface CommentMarkOptions { HTMLAttributes: Record<string, unknown>; }

declare module "@tiptap/core" {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Commands<ReturnType> {
        commentMark: {
            setCommentMark: (threadId: string, from: number, to: number) => ReturnType;
            unsetCommentMark: (threadId: string) => ReturnType;
        };
    }
}

function stripCommentMark(fragment: Fragment, markName: string): Fragment {
    const nodes: PMNode[] = [];
    fragment.forEach(node => {
        const cleanedMarks = node.marks.filter(m => m.type.name !== markName);
        const cleanedChildren = node.content.size > 0
            ? stripCommentMark(node.content, markName)
            : node.content;
        nodes.push(node.copy(cleanedChildren).mark(cleanedMarks));
    });
    return Fragment.fromArray(nodes);
}

export const CommentMark = Mark.create<CommentMarkOptions>({
    name: "commentMark",
    inclusive: false,
    excludes: "",
    addOptions() { return { HTMLAttributes: {} }; },
    addAttributes() {
        return {
            threadId: {
                default: null,
                parseHTML: el => (el as HTMLElement).getAttribute("data-thread-id"),
                renderHTML: attrs => attrs.threadId ? { "data-thread-id": attrs.threadId } : {},
            },
        };
    },
    parseHTML() { return [{ tag: "span[data-thread-id]" }]; },
    renderHTML({ HTMLAttributes }) {
        return ["span", mergeAttributes({ class: "ui-comment-mark" }, this.options.HTMLAttributes, HTMLAttributes), 0];
    },
    addCommands() {
        return {
            // Принимает явный диапазон (from/to) чтобы не зависеть от текущего selection —
            // к моменту submit() редактор мог потерять фокус и selection сбрасывается.
            setCommentMark: (threadId: string, from: number, to: number) => ({ tr, dispatch }) => {
                if (from === to) return false;
                const type = tr.doc.type.schema.marks["commentMark"];
                if (!type) return false;
                if (dispatch) {
                    tr.addMark(from, to, type.create({ threadId }));
                    tr.setMeta("addToHistory", false);
                }
                return true;
            },
            unsetCommentMark: (threadId: string) => ({ tr, dispatch, state }) => {
                const type = state.schema.marks[this.name];
                if (dispatch) {
                    state.doc.descendants((node, pos) => {
                        node.marks.forEach(m => {
                            if (m.type === type && m.attrs.threadId === threadId) {
                                tr.removeMark(pos, pos + node.nodeSize, m);
                            }
                        });
                    });
                    tr.setMeta("addToHistory", false);
                }
                return true;
            },
        };
    },
    addProseMirrorPlugins() {
        const markName = this.name;
        return [
            new Plugin({
                key: new PluginKey("commentMark:stripOnPaste"),
                props: {
                    transformPasted(slice) {
                        const cleaned = stripCommentMark(slice.content, markName);
                        return new Slice(cleaned, slice.openStart, slice.openEnd);
                    },
                },
            }),
        ];
    },
});