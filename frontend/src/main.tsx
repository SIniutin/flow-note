import React, {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import "./styles/tokens.css";
import './index.css'
import App from './App.jsx'
import {CommentsProvider} from "./editor/comments/CommentsContext";
import {useAuth} from "./data/authStore";
import {AuthPage} from "./pages/AuthPage";
import {useCurrentPage} from "./data/pagesStore";
import {getCurrentUserId} from "./data/authStore";

function AuthGate({ children }: { children: React.ReactNode }) {
    const { authenticated } = useAuth();
    if (!authenticated) return <AuthPage />;
    return <>{children}</>;
}

// CommentsProvider нужен внутри App чтобы знать текущий pageId.
// Выносим в отдельный компонент чтобы не дублировать логику.
function Root() {
    const currentPage = useCurrentPage();
    const pageId = currentPage?.id;
    const currentUserId = getCurrentUserId() ?? undefined;
    return (
        <CommentsProvider pageId={pageId} currentUserId={currentUserId}>
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
