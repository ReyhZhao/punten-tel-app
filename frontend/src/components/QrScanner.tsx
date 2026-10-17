import React, { useEffect, useRef, useState } from 'react';
import { Theme } from '../types';
import { createQrDetector, parseInviteCode } from '../inviteCode';
import { Hint } from './ui/Sheet';

/** Camerabeeld dat zoekt naar een QR-code met een uitnodigcode. */
export default function QrScanner({ theme: t, onCode }: { theme: Theme; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    const detector = createQrDetector();

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(async (s) => {
      if (stopped) { s.getTracks().forEach((tr) => tr.stop()); return; }
      stream = s;
      const v = video.current!;
      v.srcObject = s;
      await v.play();
      timer = setInterval(async () => {
        if (v.readyState < 2) return;
        try {
          for (const b of await detector.detect(v)) {
            const code = parseInviteCode(b.rawValue);
            if (code && !stopped) { stopped = true; onCodeRef.current(code); return; }
          }
        } catch {
          // volgende frame
        }
      }, 300);
    }).catch(() => setError('Geen toegang tot de camera. Vul de code met de hand in.'));

    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  if (error) return <Hint theme={t} error>{error}</Hint>;
  return (
    <video ref={video} playsInline muted
      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 16, background: t.surface2 }} />
  );
}
