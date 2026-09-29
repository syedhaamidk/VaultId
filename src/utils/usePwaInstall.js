import { useState, useEffect, useCallback } from 'react';

/**
 * PWA install prompt hook. Captures the beforeinstallprompt event
 * and provides a function to trigger the install prompt.
 */
export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed.
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setCanInstall(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (window.promptInstall) {
      return window.promptInstall();
    }
    return false;
  }, []);

  return { canInstall, installed, promptInstall };
}
