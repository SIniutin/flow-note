import React, { useState } from "react";
import { login, register } from "../data/authStore";
import "./auth.css";

type Tab = "login" | "register";

// ── Eye icon ──────────────────────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
    return open ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    );
}

// ── Password field ────────────────────────────────────────────────────────────

interface PasswordFieldProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    autoComplete?: string;
}

function PasswordField({ label, value, onChange, placeholder = "••••••••", autoComplete }: PasswordFieldProps) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="auth-field">
            <label>{label}</label>
            <div className="auth-field__input-wrap">
                <input
                    type={visible ? "text" : "password"}
                    className={visible ? "is-password" : ""}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    required
                />
                <button
                    type="button"
                    className="auth-eye"
                    tabIndex={-1}
                    onClick={() => setVisible(v => !v)}
                    aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
                >
                    <EyeIcon open={visible} />
                </button>
            </div>
        </div>
    );
}

// ── Auth page ─────────────────────────────────────────────────────────────────

export function AuthPage() {
    const [tab, setTab] = useState<Tab>("login");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // login
    const [loginId, setLoginId] = useState("");
    const [loginPwd, setLoginPwd] = useState("");

    // register
    const [regEmail, setRegEmail] = useState("");
    const [regLogin, setRegLogin] = useState("");
    const [regPwd, setRegPwd] = useState("");
    const [regPwd2, setRegPwd2] = useState("");

    const switchTab = (t: Tab) => { setTab(t); setError(null); };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const identifier = loginId.includes("@") ? { email: loginId } : { login: loginId };
            await login(identifier, loginPwd);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Ошибка входа");
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (regPwd !== regPwd2) { setError("Пароли не совпадают"); return; }
        setLoading(true);
        try {
            await register(regEmail, regLogin, regPwd);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Ошибка регистрации");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-root">
            <div className="auth-bg" />

            <div className="auth-card">
                {/* Logo */}
                <div className="auth-logo">
                    <div className="auth-logo__icon">⚡</div>
                    <div className="auth-logo__text">
                        <span className="auth-logo__name">FlowNote</span>
                        <span className="auth-logo__tagline">Collaborative workspace</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="auth-tabs">
                    <button className={`auth-tab${tab === "login" ? " is-active" : ""}`} onClick={() => switchTab("login")}>
                        Войти
                    </button>
                    <button className={`auth-tab${tab === "register" ? " is-active" : ""}`} onClick={() => switchTab("register")}>
                        Регистрация
                    </button>
                    <div className={`auth-tabs__slider${tab === "register" ? " is-right" : ""}`} />
                </div>

                {/* Login form */}
                {tab === "login" && (
                    <form className="auth-form" onSubmit={handleLogin}>
                        <div className="auth-field">
                            <label htmlFor="login-id">Email или логин</label>
                            <input
                                id="login-id"
                                type="text"
                                value={loginId}
                                onChange={e => setLoginId(e.target.value)}
                                placeholder="you@example.com"
                                autoComplete="username"
                                required
                            />
                        </div>
                        <PasswordField
                            label="Пароль"
                            value={loginPwd}
                            onChange={setLoginPwd}
                            autoComplete="current-password"
                        />
                        {error && <div className="auth-error">{error}</div>}
                        <button type="submit" className="auth-submit" disabled={loading}>
                            {loading ? <span className="auth-spinner" /> : "Войти"}
                        </button>
                    </form>
                )}

                {/* Register form */}
                {tab === "register" && (
                    <form className="auth-form" onSubmit={handleRegister}>
                        <div className="auth-field">
                            <label htmlFor="reg-email">Email</label>
                            <input
                                id="reg-email"
                                type="email"
                                value={regEmail}
                                onChange={e => setRegEmail(e.target.value)}
                                placeholder="you@example.com"
                                autoComplete="email"
                                required
                            />
                        </div>
                        <div className="auth-field">
                            <label htmlFor="reg-login">Логин</label>
                            <input
                                id="reg-login"
                                type="text"
                                value={regLogin}
                                onChange={e => setRegLogin(e.target.value)}
                                placeholder="username"
                                autoComplete="username"
                                required
                            />
                        </div>
                        <PasswordField
                            label="Пароль"
                            value={regPwd}
                            onChange={setRegPwd}
                            autoComplete="new-password"
                        />
                        <PasswordField
                            label="Повторите пароль"
                            value={regPwd2}
                            onChange={setRegPwd2}
                            autoComplete="new-password"
                        />
                        {error && <div className="auth-error">{error}</div>}
                        <button type="submit" className="auth-submit" disabled={loading}>
                            {loading ? <span className="auth-spinner" /> : "Создать аккаунт"}
                        </button>
                    </form>
                )}

                {/* Hint */}
                <div className="auth-hint">
                    {tab === "login"
                        ? <>Нет аккаунта? <button type="button" onClick={() => switchTab("register")}>Зарегистрироваться</button></>
                        : <>Уже есть аккаунт? <button type="button" onClick={() => switchTab("login")}>Войти</button></>
                    }
                </div>
            </div>
        </div>
    );
}
