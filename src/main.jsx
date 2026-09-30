import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import '@chomuiro/saisei/dist/blueprint.css';
import './saisei-theme.css';
import './index.css';

// Unregister stale service workers and clear caches on version change.
// Prevents blank-screen issues when a new build is deployed but the old
// SW is still serving cached assets.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((reg) => reg.unregister());
  });
  if (window.caches) {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
}

// VaultID is a dark-first brand: lock the Saisei theme to dark.
document.documentElement.dataset.theme = 'dark';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the service worker for PWA / offline support.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed — app still works, just no offline support.
    });
  });
}

// PWA install prompt — capture the beforeinstallprompt event.
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

// Expose a function to trigger the install prompt (called from the UI).
window.promptInstall = async () => {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
};
