import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Fragment, Slice, type Node as PMNode } from "@tiptap/pm/model";

export interface CommentMarkOptions { HTMLAttributes: Record<string, unknown>; }

declare module "@tiptap/core" {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Commands<ReturnType> {
        commentMark: {
            setCommentMark: (threadId: string) => ReturnType;
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
            setCommentMark: (threadId) => ({ tr, dispatch, state }) => {
                if (!dispatch) return false;
                const { from, to } = state.selection;
                const type = state.schema.marks[this.name];
                tr.addMark(from, to, type.create({ threadId }));
                tr.setMeta("addToHistory", false);
                dispatch(tr);
                return true;
            },
            unsetCommentMark: (threadId) => ({ tr, dispatch, state }) => {
                if (!dispatch) return false;
                const { doc } = state;
                const type = state.schema.marks[this.name];
                doc.descendants((node, pos) => {
                    node.marks.forEach(m => {
                        if (m.type === type && m.attrs.threadId === threadId) {
                            tr.removeMark(pos, pos + node.nodeSize, m);
                        }
                    });
                });
                tr.setMeta("addToHistory", false);
                dispatch(tr);
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