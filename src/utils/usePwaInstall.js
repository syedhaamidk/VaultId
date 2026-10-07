import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * PWA install hook — single owner of the install flow.
 *
 * - Captures and stores the `beforeinstallprompt` event (Chromium/Android).
 * - `promptInstall()` triggers the stored prompt; returns true when accepted.
 * - iOS Safari has no install prompt: `isIos` lets the UI show manual
 *   "Share → Add to Home Screen" instructions instead.
 * - `installed` is true when already running as an installed PWA.
 */
function detectIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ in desktop mode reports MacIntel — touch points give it away.
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

// Coarse platform used to pick install instructions when the native
// prompt is unavailable: 'ios' | 'android' | 'desktop' | 'other'.
function detectPlatform() {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (detectIos()) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Windows|Macintosh|MacIntel|Linux|X11|CrOS/.test(ua) || /Chrome|Edg|Safari|Firefox/.test(ua)) return 'desktop';
  return 'other';
}

function detectStandalone() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  // Legacy iOS standalone flag.
  return window.navigator.standalone === true;
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(() => detectStandalone());
  const [isIos] = useState(() => detectIos());
  const [platform] = useState(() => detectPlatform());
  const deferredRef = useRef(null);

  useEffect(() => {
    if (detectStandalone()) {
      setInstalled(true);
      return;
    }
    const onBeforeInstall = (e) => {
      e.preventDefault();
      deferredRef.current = e;
      setCanInstall(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setCanInstall(false);
      deferredRef.current = null;
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const deferred = deferredRef.current;
    if (!deferred || typeof deferred.prompt !== 'function') return false;
    deferred.prompt();
    let accepted = false;
    try {
      const choice = await deferred.userChoice;
      accepted = choice && choice.outcome === 'accepted';
    } catch {
      accepted = false;
    }
    if (accepted) {
      deferredRef.current = null;
      setCanInstall(false);
    }
    return accepted;
  }, []);

  return { canInstall, installed, isIos, platform, promptInstall };
}
