import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register PWA Service Worker (Part 2A)
if ('serviceWorker' in navigator && !window.location.host.includes('playwright')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[SW] ServiceWorker registration error:', err);
    });
  });
}
