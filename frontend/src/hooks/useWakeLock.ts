import { useEffect, useRef } from 'react';

/**
 * Houdt het scherm actief zolang `enabled` waar is, via de Screen Wake Lock API.
 *
 * De browser geeft een wake lock automatisch vrij zodra het tabblad naar de
 * achtergrond gaat, dus we vragen 'm opnieuw aan bij terugkeer (visibilitychange).
 * Niet alle browsers ondersteunen de API (o.a. oudere iOS); daar doet de hook niks.
 */
export function useWakeLock(enabled: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;

    const request = async () => {
      if (lockRef.current || document.visibilityState !== 'visible') return;
      try {
        lockRef.current = await navigator.wakeLock.request('screen');
        lockRef.current.addEventListener('release', () => {
          lockRef.current = null;
        });
      } catch {
        // Aanvraag kan falen (bv. laag batterijniveau) — stilletjes negeren.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') request();
    };

    request();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [enabled]);
}
