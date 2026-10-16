import { STORE_KEY } from './store';

/** Herkenningsteken voor de iOS-app (zie PWAImport.swift). */
export const EXPORT_FORMAT = 'puntenteller-pwa-export';

export type ExportResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Exporteert alle opgeslagen spellen, spelers en profielen als JSON-bestand,
 * zodat de iOS-app ze kan importeren. Deelt via het deelmenu als dat kan
 * (iOS: "Open in Puntenteller" of "Bewaar in Bestanden"), anders downloaden.
 * Er wordt niets verwijderd.
 */
export async function exportForIOS(): Promise<ExportResult> {
  let data: unknown = { games: [], savedPlayers: [], gameProfiles: [] };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) data = JSON.parse(raw);
  } catch {
    // lege export
  }
  const payload = {
    format: EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
  const filename = `puntenteller-export-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify(payload)], filename, { type: 'application/json' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Puntenteller-export' });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
      // Delen mislukt: val terug op downloaden.
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
