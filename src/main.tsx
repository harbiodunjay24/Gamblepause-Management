import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {registerSW} from 'virtual:pwa-register';

// Register service worker with auto-update for offline and low-connectivity readiness
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New version available, updated in background.');
  },
  onOfflineReady() {
    console.log('[PWA] GamblePause forms and materials are cached for offline access.');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
