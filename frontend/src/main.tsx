import React, {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import "./styles/tokens.css";
import './index.css'
import App from './App.jsx'
import {CommentsProvider} from "./editor/comments/CommentsContext";
import {useAuth} from "./data/authStore";
import {AuthPage} from "./pages/AuthPage";
import {useCurrentPage} from "./data/pagesStore";

function AuthGate({ children }: { children: React.ReactNode }) {
    const { authenticated } = useAuth();
    if (!authenticated) return <AuthPage />;
    return <>{children}</>;
}

function Root() {
    const currentPage = useCurrentPage();
    return (
        <CommentsProvider pageId={currentPage?.id}>
            <App/>
        </CommentsProvider>
    );
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <AuthGate>
            <Root/>
        </AuthGate>
    </StrictMode>
)
