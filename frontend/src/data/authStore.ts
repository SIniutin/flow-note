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
    clearRefreshTimer();
    localStorage.removeItem(LS_ACCESS);
    localStorage.removeItem(LS_REFRESH);
}

// ── Auto token refresh ────────────────────────────────────────────────────────

let _refreshTimer: ReturnType<typeof setTimeout> | null = null;

function parseExpiry(token: string): number | null {
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return typeof payload.exp === "number" ? payload.exp * 1000 : null; // → ms
    } catch { return null; }
}

function clearRefreshTimer() {
    if (_refreshTimer !== null) { clearTimeout(_refreshTimer); _refreshTimer = null; }
}

async function performRefresh(): Promise<void> {
    if (!_refreshToken) { wipe(); notify(); return; }
    try {
        const tokens = await authClient.refresh(_refreshToken);
        persist(tokens);
        notify();
        scheduleTokenRefresh();
        // Сообщаем провайдерам что нужно переподключиться с новым токеном
        window.dispatchEvent(new CustomEvent("auth:token-refreshed"));
    } catch {
        // refresh_token протух — разлогиниваем
        wipe();
        notify();
    }
}

export function scheduleTokenRefresh(): void {
    clearRefreshTimer();
    if (!_accessToken || !_refreshToken) return;

    const exp = parseExpiry(_accessToken);
    if (!exp) return;

    // Обновляем за 60 секунд до истечения
    const delay = exp - Date.now() - 60_000;
    if (delay <= 0) {
        // Токен уже истёк или скоро истечёт — обновляем немедленно
        void performRefresh();
        return;
    }
    _refreshTimer = setTimeout(() => void performRefresh(), delay);
}

// ── public actions ────────────────────────────────────────────────────────────

export function getAccessToken(): string | null { return _accessToken; }

/** Декодирует sub из JWT-payload без верификации подписи. */
export function getCurrentUserId(): string | null {
    if (!_accessToken) return null;
    try {
        const payload = JSON.parse(atob(_accessToken.split(".")[1]));
        return (payload.sub as string) || null;
    } catch { return null; }
}

export async function login(
    identifier: { email?: string; login?: string },
    password: string,
) {
    const res = await authClient.login(identifier, password);
    _user = res.user;
    persist(res.tokens);
    scheduleTokenRefresh();
    notify();
    return res;
}

export async function register(email: string, login: string, password: string) {
    const res = await authClient.register(email, login, password);
    _user = res.user;
    persist(res.tokens);
    scheduleTokenRefresh();
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

// Запускаем таймер сразу при загрузке, если токен уже есть в localStorage
scheduleTokenRefresh();

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
