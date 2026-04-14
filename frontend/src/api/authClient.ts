// ─── src/api/authClient.ts ────────────────────────────────────────────────────

export interface AuthUser {
    id: string;
    email: string;
    login: string;
    createdAt: string;
    updatedAt: string;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

export interface AuthResponse {
    user: AuthUser;
    tokens: TokenPair;
}

async function get<T>(path: string, accessToken?: string): Promise<T> {
    const headers: Record<string, string> = {};
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    const res = await fetch(path, { method: "GET", headers });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        let message = text;
        try { message = JSON.parse(text).message ?? text; } catch { /* raw text */ }
        throw new Error(message || `HTTP ${res.status}`);
    }
    return res.json();
}

async function post<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        let message = text;
        try { message = JSON.parse(text).message ?? text; } catch { /* raw text */ }
        throw new Error(message || `HTTP ${res.status}`);
    }
    // 204 / empty body
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return undefined as T;
    return res.json();
}

export const authClient = {
    register(email: string, login: string, password: string): Promise<AuthResponse> {
        return post("/v1/auth/register", { email, login, password });
    },

    login(identifier: { email?: string; login?: string }, password: string): Promise<AuthResponse> {
        return post("/v1/auth/login", { ...identifier, password });
    },

    refresh(refreshToken: string): Promise<TokenPair> {
        return post("/v1/auth/refresh", { refreshToken });
    },

    logout(refreshToken: string, access_token: string): Promise<void> {
        return post("/v1/auth/logout", { refreshToken }, access_token);
    },

    getById(id: string, access_token?: string): Promise<{ user: AuthUser }> {
        return get(`/v1/users/${encodeURIComponent(id)}`, access_token);
    },

    getByName(login: string, access_token?: string): Promise<{ user: AuthUser }> {
        return get(`/v1/users/by-name/${encodeURIComponent(login)}`, access_token);
    },
};
