import { useState, lazy, Suspense } from 'react';
import LandingPage from './pages/LandingPage.jsx';
import PrivacyPolicy from './pages/PrivacyPolicy.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// Code-split the vault app — landing-page visitors don't download it.
const VaultApp = lazy(() => import('./pages/VaultApp.jsx'));

export default function App() {
  const [page, setPage] = useState('landing'); // landing | vault | privacy

  if (page === 'privacy') {
    return (
      <ErrorBoundary fallbackTitle="Privacy page hit an error">
        <PrivacyPolicy onBack={() => setPage('landing')} />
      </ErrorBoundary>
    );
  }

  return page === 'vault'
    ? <ErrorBoundary fallbackTitle="Vault hit an error">
        <Suspense fallback={<div style={{ height: '100vh', background: 'var(--bg)' }} />}>
          <VaultApp onBack={() => setPage('landing')} />
        </Suspense>
      </ErrorBoundary>
    : <ErrorBoundary fallbackTitle="Landing page hit an error">
        <LandingPage onEnterVault={() => setPage('vault')} onPrivacy={() => setPage('privacy')} />
      </ErrorBoundary>;
}
