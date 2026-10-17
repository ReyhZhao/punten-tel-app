import qrcode from 'qrcode-generator';

/**
 * Uitnodigcode (CONTEXT.md): 6 cijfers die een speler in Account toont, ook
 * als QR-code. De QR-code bevat een link naar de app met de code erin, zodat
 * ook de iOS-app en een gewone camera er iets mee kunnen.
 */

export const formatInviteCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

export const inviteQrPayload = (code: string) => `https://punten.vels.online/?uitnodigcode=${code}`;

/** Code uit getypte tekst of een gescande QR-code; `null` als het geen code is. */
export function parseInviteCode(text: string): string | null {
  const trimmed = text.trim();
  try {
    const fromUrl = new URL(trimmed).searchParams.get('uitnodigcode');
    if (fromUrl && /^\d{6}$/.test(fromUrl)) return fromUrl;
  } catch {
    // geen URL
  }
  const digits = trimmed.replace(/\s/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
}

/** SVG-pad van de QR-code (1 eenheid per module) en het aantal modules. */
export function qrPath(text: string): { path: string; size: number } {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  let path = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    }
  }
  return { path, size };
}

// BarcodeDetector staat (nog) niet in lib.dom; alleen wat we gebruiken.
interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

const Detector = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;

/** QR-codes scannen kan (Chrome op Android; niet in Safari). */
export const canScanQr = !!Detector && !!navigator.mediaDevices?.getUserMedia;

export const createQrDetector = (): BarcodeDetectorLike => new Detector!({ formats: ['qr_code'] });
