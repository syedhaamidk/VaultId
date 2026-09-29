import { useState, useEffect } from 'react';

/**
 * Detects low-end devices that may struggle with WebGL/Three.js.
 * Uses deviceMemory and hardwareConcurrency when available, with a
 * conservative fallback for browsers that don't expose them.
 */
export function useLowEndDevice() {
  const [isLowEnd, setIsLowEnd] = useState(false);

  useEffect(() => {
    const memory = navigator.deviceMemory;
    const cores = navigator.hardwareConcurrency;

    // If both are available, use them.
    if (memory !== undefined && cores !== undefined) {
      setIsLowEnd(memory < 4 || cores < 4);
      return;
    }

    // If only one is available, use it.
    if (memory !== undefined) {
      setIsLowEnd(memory < 4);
      return;
    }
    if (cores !== undefined) {
      setIsLowEnd(cores < 4);
      return;
    }

    // Fallback: assume low-end if the device has a small screen (mobile).
    setIsLowEnd(window.innerWidth < 768);
  }, []);

  return isLowEnd;
}
