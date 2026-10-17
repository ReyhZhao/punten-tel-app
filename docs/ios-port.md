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

Teksten, privacylabel, leeftijdsclassificatie, review-notities en de volledige
checklist staan in [`app-store.md`](app-store.md).

- [x] Team-id in het project
- [x] TestFlight-builds (App Store Connect-record bestaat)
- [x] Export compliance (`ITSAppUsesNonExemptEncryption = NO`)
- [x] Privacybeleid en supportpagina (`/privacy`, `/support` op punten.vels.online)
- [x] Privacy-manifest (`PrivacyInfo.xcprivacy`)
- [x] Screenshots 6,9", beschrijving NL/EN, trefwoorden, privacylabel, leeftijdsclassificatie (`app-store.md`)
- [x] Review-account met vaste code (backend)
- [ ] Review-code in Vault en `api.review.email` invullen; PWA en API uitrollen
- [ ] Ter review indienen

## Fase 3 — Sync (zie `backend/README.md`, ADR-0003)

- [x] Backend: accounts met e-mailcode, sync, uitnodigen op e-mailadres, deelnemers laten scoren
- [x] Uitrol op hetzelfde domein (Helm: `/api/`, `/admin/`)
- [x] Sync-kern in `PuntentellerKit` (`Sync.swift`): gewijzigde spellen bijhouden, cursor, antwoord toepassen
- [x] Account aanmaken / inloggen met code, uitloggen, account verwijderen (Instellingen → Account)
- [x] Speler uitnodigen op e-mailadres; `SavedPlayer.accountId` onthouden
- [x] Invoer op eigen speler (`stayOnOwnPlayer`): de invoer blijft na een boeking op je eigen speler (ook PWA)
- [x] Uitnodigcode (6 cijfers, 10 min geldig) en QR-code tonen in Account; code invullen of scannen bij Uitnodigen (ook PWA)
- [x] Instelling "Deelnemers mogen scores bijhouden" bij een nieuw spel
- [x] Gedeelde spellen tonen ("Gedeeld door …"), alleen bekijken als scoren niet mag; spel verlaten
- [x] Syncen bij openen, elke 20 s op de voorgrond, na wijzigingen en met pull-to-refresh
- [x] Zelfde functionaliteit in de PWA (`frontend/src/sync.ts`, `useSync.ts`)
- [x] Spelers uitnodigen in een lopend spel, "Alle spelers mogen scores invoeren" en eigenaar overdragen (Spelers en delen)
- [x] Realtime updates via SSE (`docs/research/sse-realtime-updates.md`)
- [x] Pushmeldingen (APNs): uitgenodigd, spel afgelopen, overdracht; tik opent het spel
- [ ] APNs-sleutel in Vault en `api.push.keyId` invullen (zie `backend/README.md`)
- [ ] Web Push voor de PWA (optioneel)
