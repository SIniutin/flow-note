import React, {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import "./styles/tokens.css";   // design tokens — первыми, чтобы переменные были готовы
import './index.css'             // только box-sizing reset
import App from './App.jsx'
import {CommentsProvider} from "./editor/comments/CommentsContext";
import {useAuth} from "./data/authStore";
import {AuthPage} from "./pages/AuthPage";

function AuthGate({ children }: { children: React.ReactNode }) {
    const { authenticated } = useAuth();
    if (!authenticated) return <AuthPage />;
    return <>{children}</>;
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <AuthGate>
            <CommentsProvider>
                <App/>
            </CommentsProvider>
        </AuthGate>
    </StrictMode>
)