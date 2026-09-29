import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import '@chomuiro/saisei/dist/blueprint.css';
import './saisei-theme.css';
import './index.css';

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
