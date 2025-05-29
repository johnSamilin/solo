import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { StoreProvider } from './stores/StoreProvider';
import { registerSW } from './pwa';
import { init } from '@umami/analytics';

// Initialize Umami analytics if configured
if (import.meta.env.VITE_UMAMI_WEBSITE_ID && import.meta.env.VITE_UMAMI_HOST) {
  init({
    websiteId: import.meta.env.VITE_UMAMI_WEBSITE_ID,
    scriptUrl: `${import.meta.env.VITE_UMAMI_HOST}/script.js`
  });
}

// Register service worker
registerSW();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>
);