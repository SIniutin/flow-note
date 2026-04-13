// ─── src/types/collab-modules.d.ts ────────────────────────────────────────────
// Ambient-декларации для пакетов совместного редактирования.
// Нужны если TypeScript не может найти типы автоматически
// (до npm install или при нестандартном moduleResolution).

declare module "yjs" {
    export class Doc {
        clientID: number;

        getXmlFragment(name: string): XmlFragment;

        destroy(): void;
    }

    export class XmlFragment {
        length: number;
    }

    export class Map<T = unknown> {
        get(key: string): T | undefined;

        set(key: string, value: T): void;

        observe(f: (event: unknown) => void): void;
    }

    export class Text {
        toString(): string;
    }
}

declare module "y-webrtc" {
    import type {Doc} from "yjs";

    interface WebrtcProviderOptions {
        signaling?: string[];
        password?: string | null;
        awareness?: unknown;
        maxConns?: number;
        filterBcConns?: boolean;
        peerOpts?: Record<string, unknown>;
    }

    export class WebrtcProvider {
        awareness: Awareness;

        constructor(roomName: string, doc: Doc, opts?: WebrtcProviderOptions);

        destroy(): void;
    }

    export class Awareness {
        clientID: number;

        getStates(): Map<number, Record<string, unknown>>;

        setLocalStateField(field: string, value: unknown): void;

        on(event: string, callback: () => void): void;

        off(event: string, callback: () => void): void;
    }
}

declare module "@tiptap/extension-collaboration" {
    import type {Extension} from "@tiptap/core";
    import type {Doc, XmlFragment} from "yjs";

    interface CollaborationOptions {
        document?: Doc | null;
        field?: string;
        fragment?: XmlFragment | null;
        provider?: unknown;
        onFirstRender?: () => void;
    }

    const Collaboration: Extension<CollaborationOptions>;
    export default Collaboration;
    export {Collaboration};
}

declare module "@tiptap/extension-collaboration-cursor" {
    import type {Extension} from "@tiptap/core";
    import type {DecorationAttrs} from "@tiptap/pm/view";

    interface CollaborationCursorOptions {
        provider: unknown;
        user: Record<string, unknown>;
        render?: (user: Record<string, string>) => HTMLElement;
        selectionRender?: (user: Record<string, string>) => DecorationAttrs;
        onUpdate?: (users: unknown[]) => void;
    }

    const CollaborationCursor: Extension<CollaborationCursorOptions>;
    export default CollaborationCursor;
    export {CollaborationCursor};
}

declare module "@tiptap/y-tiptap" {
    export function ySyncPlugin(...args: unknown[]): unknown;

    export function yUndoPlugin(...args: unknown[]): unknown;
}