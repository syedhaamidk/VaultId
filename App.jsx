import { useState } from 'react';
import LandingPage from './pages/LandingPage.jsx';
import VaultApp    from './pages/VaultApp.jsx';

export default function App() {
  const [page, setPage] = useState('landing');

  return page === 'vault'
    ? <VaultApp    onBack={()      => setPage('landing')} />
    : <LandingPage onEnterVault={() => setPage('vault')}  />;
}
