# iOS-port: plan en checklist

Het gewenste gedrag staat in de PWA (`frontend/`) en in
[`design-handoff.md`](design-handoff.md). Gedragsverschillen staan in
[ADR-0002](adr/0002-sync-klaar-datamodel.md).

## Fase 0 — Fundament ✅

- [x] Xcode-project + `PuntentellerKit`-package
- [x] Domeinmodel (`Game`, `Player`, `ScoreEntry`, `GameRules`, `GameProfile`, `SavedPlayer`)
- [x] Spelregels uit `store.ts`: boeken, undo, max score + eindmodi, max rondes, ranglijst, leiders, winnaar
- [x] Opnieuw spelen, scores resetten, afgeleide statistiek
- [x] JSON-formaat (ISO-8601)
- [x] Confetti-kleuren en radii in `Theme.swift`

## Fase 1 — Feature-gelijkheid met de PWA

| PWA (`frontend/src/…`)                   | iOS                      | Status |
|------------------------------------------|--------------------------|--------|
| `store.ts` — opslag in `localStorage`     | `AppData` (Kit) + `GameStore` (@Observable), JSON in Application Support | ✅ |
| `screens/HomeScreen.tsx`                  | `HomeView`               | ✅ (verwijderen via lang drukken) |
| `screens/NewGameScreen.tsx` (+ profielen) | `NewGameView`            | ✅ profiel zoeken/toepassen/bewaren, bewaarde spelers als suggestie |
| `screens/ScoringScreen.tsx`               | `ScoringView`            | ✅ ronde, max-melding, zwevende +N/−N, menu |
| `game/TurnTimer.tsx`                      | `TurnTimerView` (in `ScoringView`) | ✅ (+ schudden en trillen bij 0) |
| `game/HistorySheet.tsx`                   | `HistoryView` (sheet)    | ✅ |
| `game/ActionSheet.tsx`                    | `Menu` + `confirmationDialog` | ✅ (bevestiging bij resetten en verwijderen) |
| `screens/WinnerScreen.tsx` + `ui/Confetti.tsx` | `WinnerView` + `ConfettiView` | ✅ ("Opnieuw spelen" maakt een nieuw spel, ADR-0002) |
| `screens/PlayersScreen.tsx`               | `PlayersView`            | ✅ |
| `SettingsSheet.tsx`                       | `SettingsView`           | ✅ (+ importeren uit web-app) |
| `hooks/useWakeLock.ts`                    | `isIdleTimerDisabled` via `@AppStorage("keepAwake")` | ✅ |
| `InstallGuide` / `InstallPrompt` / `pwa.ts` | — alleen PWA            | n.v.t. |

Nog nodig:

- [ ] Fredoka-font bundelen (OFL-licentie) en registreren via `UIAppFonts`; `Theme.display` daarop laten wijzen
- [x] App-icoon 1024×1024 zonder transparantie, gegenereerd uit `frontend/public/pwa-icon.svg`
- [ ] Optioneel: donkere en getinte varianten van het app-icoon (iOS 18+)
- [x] Haptics bij +/− en bij het einde van het spel
- [x] Haptics bij het einde van de timer
- [x] Export uit de PWA (Instellingen → Exporteren naar iOS-app) en import in de iOS-app (deelmenu of bestandskiezer), zie `PWAImport.swift`

## Fase 2 — App Store

- [x] Team-id in het project
- [ ] App Store Connect-record
- [ ] Privacybeleid-URL (lokale data; straks ook account- en sync-data)
- [ ] Screenshots (6,9"), beschrijving (NL/EN), leeftijdsclassificatie
- [ ] TestFlight-beta

## Fase 3 — Sync (zie `backend/README.md`, ADR-0003)

- [x] Backend: accounts met e-mailcode, sync, uitnodigen op e-mailadres, deelnemers laten scoren
- [x] Uitrol op hetzelfde domein (Helm: `/api/`, `/admin/`)
- [ ] `SyncService` in `PuntentellerKit`: wijzigingen sinds de laatste sync bijhouden, cursor bewaren, antwoord toepassen
- [ ] Account aanmaken / inloggen met code, uitloggen, account verwijderen (instellingen)
- [ ] Speler uitnodigen op e-mailadres; `SavedPlayer.accountId` onthouden
- [ ] Instelling "Deelnemers mogen scores bijhouden" bij een spel
- [ ] Gedeelde spellen tonen ("gedeeld door …"), alleen-lezen als scoren niet mag; spel verlaten
- [ ] Verversen bij openen en met pull-to-refresh
