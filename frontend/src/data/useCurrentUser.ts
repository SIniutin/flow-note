import { useAuth, getCurrentUserId } from "./authStore";

export interface EditorUser {
    id: string;
    name: string;
    colorIndex: 1 | 2 | 3 | 4;
}

function colorFromId(id: string): 1 | 2 | 3 | 4 {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return ((h % 4) + 1) as 1 | 2 | 3 | 4;
}

export function useCurrentUser(): EditorUser {
    const { user } = useAuth();
    const id   = user?.id   ?? getCurrentUserId() ?? "anonymous";
    const name = user?.login ?? user?.email       ?? id;
    return { id, name, colorIndex: colorFromId(id) };
}
