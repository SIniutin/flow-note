// ─── src/data/authStore.ts ────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { authClient, HttpError, type AuthUser, type TokenPair } from "../api/authClient";

const LS_ACCESS  = "auth:access_token";
const LS_REFRESH = "auth:refresh_token";
const LS_USER    = "auth:user";

// ── Dev bypass ────────────────────────────────────────────────────────────────
// VITE_DEV_BYPASS_AUTH=true в .env.local → автоматически подставляет
// фейковый JWT с sub=dev-user и exp=2286г., чтобы пройти AuthGate без бэка.
// Collab WebSocket всё равно упадёт с jwt expired — это нормально.

const DEV_FAKE_JWT =
    // header: {"alg":"HS256","typ":"JWT"}
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
    // payload: {"sub":"00000000-0000-0000-0000-000000000001","exp":9999999999,"iat":1700000000}
    ".eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJleHAiOjk5OTk5OTk5OTksImlhdCI6MTcwMDAwMDAwMH0" +
    ".devonly";

const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

if (DEV_BYPASS) {
    // Всегда перезаписываем — иначе старый протухший токен остаётся и
    // scheduleTokenRefresh сразу делает refresh → получает 401 → wipe().
    localStorage.setItem(LS_ACCESS,  DEV_FAKE_JWT);
    localStorage.setItem(LS_REFRESH, DEV_FAKE_JWT);
}

// ── in-memory state ───────────────────────────────────────────────────────────

let _accessToken:  string | null = localStorage.getItem(LS_ACCESS);
let _refreshToken: string | null = localStorage.getItem(LS_REFRESH);
let _user:         AuthUser | null = (() => {
    try {
        const raw = localStorage.getItem(LS_USER);
        return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch { return null; }
})();

const listeners = new Set<() => void>();
function notify() { listeners.forEach(l => l()); }

function persist(tokens: TokenPair, user?: AuthUser) {
    _accessToken  = tokens.accessToken;
    _refreshToken = tokens.refreshToken;
    localStorage.setItem(LS_ACCESS,  tokens.accessToken);
    localStorage.setItem(LS_REFRESH, tokens.refreshToken);
    if (user) {
        _user = user;
        localStorage.setItem(LS_USER, JSON.stringify(user));
    }
}

function wipe() {
    _accessToken  = null;
    _refreshToken = null;
    _user         = null;
    clearRefreshTimer();
    localStorage.removeItem(LS_ACCESS);
    localStorage.removeItem(LS_REFRESH);
    localStorage.removeItem(LS_USER);
    // Чистим кэш страниц — после логаута/сброса БД он не актуален.
    // Без этого connectCollab успевает запустится со старым pageId ещё до редиректа.
    localStorage.removeItem("wiki:pages:v2");
    localStorage.removeItem("wiki:current-page:v2");
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

const REFRESH_RETRY_DELAY_MS = 30_000; // повтор через 30 с при сетевой ошибке

async function performRefresh(): Promise<void> {
    if (!_refreshToken) { wipe(); notify(); return; }
    try {
        const tokens = await authClient.refresh(_refreshToken);
        persist(tokens);
        notify();
        scheduleTokenRefresh();
        // Сообщаем провайдерам что нужно переподключиться с новым токеном
        window.dispatchEvent(new CustomEvent("auth:token-refreshed"));
    } catch (err) {
        if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
            // refresh-токен точно протух — разлогиниваем
            wipe();
            notify();
        } else {
            // Сетевая ошибка или временная недоступность сервера — не разлогиниваем,
            // повторяем попытку через REFRESH_RETRY_DELAY_MS.
            console.warn("[auth] refresh failed, retrying in 30s:", err);
            _refreshTimer = setTimeout(() => void performRefresh(), REFRESH_RETRY_DELAY_MS);
        }
    }
}

export function scheduleTokenRefresh(): void {
    if (DEV_BYPASS) return; // фейковый токен не рефрешим — бэка нет
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
    persist(res.tokens, res.user);
    scheduleTokenRefresh();
    notify();
    return res;
}

export async function register(email: string, login: string, password: string) {
    const res = await authClient.register(email, login, password);
    persist(res.tokens, res.user);
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

/**
 * Вызывается из API-клиентов при получении 401 от сервера.
 * Сбрасывает токены и уведомляет React — AuthGate покажет страницу входа.
 */
export function handleUnauthorized(): void {
    if (!_accessToken) return; // уже разлогинены
    wipe();
    notify();
}

// Запускаем таймер сразу при загрузке, если токен уже есть в localStorage
scheduleTokenRefresh();

// Немедленно проверяем сессию через refresh-эндпоинт.
// Refresh-токен хранится в БД — если БД сброшена, получим 401 → wipe() → редирект на auth.
// В обычном случае просто обновляем пару токенов.
if (_refreshToken && _accessToken && !DEV_BYPASS) {
    void performRefresh();
}

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
