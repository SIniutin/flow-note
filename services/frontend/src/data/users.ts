export interface User {
    id: string;
    name: string;
    role?: string;
    colorIndex: 1 | 2 | 3 | 4;
}

const USERS: User[] = [
    { id: "u_ivan",   name: "Иван Иванов",      role: "Аналитик",    colorIndex: 1 },
    { id: "u_sergey", name: "Сергей Петров",    role: "Разработчик", colorIndex: 2 },
    { id: "u_anna",   name: "Анна Смирнова",    role: "Дизайнер",    colorIndex: 3 },
    { id: "u_dmitry", name: "Дмитрий Кузнецов", role: "PM",          colorIndex: 4 },
    { id: "u_elena",  name: "Елена Соколова",   role: "QA",          colorIndex: 1 },
];

export const DEFAULT_USER_ID = USERS[0].id;

export function getAllUsers(): User[] { return USERS; }
export function getUserById(id: string | undefined): User | undefined {
    if (!id) return undefined;
    return USERS.find(u => u.id === id);
}
export function fetchUsers(query: string): User[] {
    const q = query.trim().toLowerCase();
    if (!q) return USERS;
    return USERS.filter(u => u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q));
}

const KEY_CURRENT_USER = "editor:currentUser:v1";
export function getCurrentUserId(): string {
    try { return localStorage.getItem(KEY_CURRENT_USER) || DEFAULT_USER_ID; }
    catch { return DEFAULT_USER_ID; }
}
export function setCurrentUserId(id: string): void {
    try { localStorage.setItem(KEY_CURRENT_USER, id); } catch { /* ignore */ }
}
export function getCurrentUser(): User {
    return getUserById(getCurrentUserId()) ?? USERS[0];
}