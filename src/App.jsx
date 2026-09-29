import { useState, lazy, Suspense } from 'react';
import LandingPage from './pages/LandingPage.jsx';

// Code-split the vault app — landing-page visitors don't download it.
const VaultApp = lazy(() => import('./pages/VaultApp.jsx'));

export default function App() {
  const [page, setPage] = useState('landing');

  return page === 'vault'
    ? <Suspense fallback={<div style={{ height: '100vh', background: 'var(--bg)' }} />}>
        <VaultApp onBack={() => setPage('landing')} />
      </Suspense>
    : <LandingPage onEnterVault={() => setPage('vault')} />;
}
