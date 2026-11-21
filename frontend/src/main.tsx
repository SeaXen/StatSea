import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
// Register service worker for PWA
registerSW({ immediate: true })
import { setupErrorReporting } from './utils/errorReporting'
setupErrorReporting();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
