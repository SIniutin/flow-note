import { useContext } from "react";
import { CommentsCtx } from "./commentsCtx";
export type { Thread } from "./commentsCtx";

export function useComments() {
    const ctx = useContext(CommentsCtx);
    if (!ctx) throw new Error("useComments must be used within CommentsProvider");
    return ctx;
}