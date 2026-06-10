import { useEffect, useState } from 'react';

export type Platform = 'ios' | 'android' | 'desktop';

/** Het beforeinstallprompt-event is (nog) niet getypeerd in de standaard lib. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const HINT_KEY = 'pwa-install-hint-seen';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  // Vroeg registreren zodat we het event opvangen voordat React klaar is.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    markHintSeen();
    notify();
  });
}

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  // iPadOS 13+ doet zich voor als macOS; herken 'm aan touch-ondersteuning.
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
  if (isIOS) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

/** True als de app al als geïnstalleerde PWA draait (standalone). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function hintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function markHintSeen(): void {
  try {
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    // ignore storage errors
  }
}

/** Opent de eigen install-prompt van de browser. Geeft true terug bij acceptatie. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return choice.outcome === 'accepted';
}

/** Reageert op beschikbaarheid van de native install-prompt. */
export function useInstall() {
  const [canInstall, setCanInstall] = useState(deferredPrompt !== null);
  useEffect(() => {
    const update = () => setCanInstall(deferredPrompt !== null);
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);
  return { canInstall, promptInstall };
}
