import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import "./styles/tokens.css";   // design tokens — первыми, чтобы переменные были готовы
import './index.css'             // только box-sizing reset
import App from './App.jsx'
import {CommentsProvider} from "./editor/comments/CommentsContext";

createRoot(document.getElementById('root')).render(
    <CommentsProvider>
        <App/>
    </CommentsProvider>
)