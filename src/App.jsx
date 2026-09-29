import { useState, lazy, Suspense } from 'react';
import LandingPage from './pages/LandingPage.jsx';
import PrivacyPolicy from './pages/PrivacyPolicy.jsx';

// Code-split the vault app — landing-page visitors don't download it.
const VaultApp = lazy(() => import('./pages/VaultApp.jsx'));

export default function App() {
  const [page, setPage] = useState('landing'); // landing | vault | privacy

  if (page === 'privacy') {
    return <PrivacyPolicy onBack={() => setPage('landing')} />;
  }

  return page === 'vault'
    ? <Suspense fallback={<div style={{ height: '100vh', background: 'var(--bg)' }} />}>
        <VaultApp onBack={() => setPage('landing')} />
      </Suspense>
    : <LandingPage onEnterVault={() => setPage('vault')} onPrivacy={() => setPage('privacy')} />;
}
