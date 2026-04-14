// ─── src/data/authStore.ts ────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { authClient, type AuthUser, type TokenPair } from "../api/authClient";

const LS_ACCESS  = "auth:access_token";
const LS_REFRESH = "auth:refresh_token";

// ── in-memory state ───────────────────────────────────────────────────────────

let _accessToken:  string | null = localStorage.getItem(LS_ACCESS);
let _refreshToken: string | null = localStorage.getItem(LS_REFRESH);
let _user:         AuthUser | null = null;

const listeners = new Set<() => void>();
function notify() { listeners.forEach(l => l()); }

function persist(tokens: TokenPair) {
    _accessToken  = tokens.accessToken;
    _refreshToken = tokens.refreshToken;
    localStorage.setItem(LS_ACCESS,  tokens.accessToken);
    localStorage.setItem(LS_REFRESH, tokens.refreshToken);
}

function wipe() {
    _accessToken  = null;
    _refreshToken = null;
    _user         = null;
    localStorage.removeItem(LS_ACCESS);
    localStorage.removeItem(LS_REFRESH);
}

// ── public actions ────────────────────────────────────────────────────────────

export function getAccessToken(): string | null { return _accessToken; }

export async function login(
    identifier: { email?: string; login?: string },
    password: string,
) {
    const res = await authClient.login(identifier, password);
    _user = res.user;
    persist(res.tokens);
    notify();
    return res;
}

export async function register(email: string, login: string, password: string) {
    const res = await authClient.register(email, login, password);
    _user = res.user;
    persist(res.tokens);
    notify();
    return res;
}

export async function logout() {
    if (_refreshToken && _accessToken) {
        await authClient.logout(_refreshToken, _accessToken).catch(() => {});
    }
    wipe();
    notify();
}

export function isAuthenticated(): boolean { return !!_accessToken; }

// ── hook ──────────────────────────────────────────────────────────────────────

export interface AuthState {
    authenticated: boolean;
    user: AuthUser | null;
    logout: () => Promise<void>;
}

export function useAuth(): AuthState {
    const [, tick] = useState(0);
    useEffect(() => {
        const l = () => tick(n => n + 1);
        listeners.add(l);
        return () => { listeners.delete(l); };
    }, []);
    return { authenticated: isAuthenticated(), user: _user, logout };
}
