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
| `screens/NewGameScreen.tsx` (+ profielen) | `NewGameView`            | ◐ alles behalve spelprofielen en bewaarde spelers kiezen |
| `screens/ScoringScreen.tsx`               | `ScoringView`            | ◐ basis: +/−, selectie, ranglijst, max-melding, menu (undo laatste, beëindigen, verwijderen); nog zonder zwevende +N |
| `game/TurnTimer.tsx`                      | `TurnTimerView`          | ☐ |
| `game/HistorySheet.tsx`                   | `.sheet` met `HistoryView` | ☐ (nu alleen undo van de laatste boeking via het menu) |
| `game/ActionSheet.tsx`                    | `.confirmationDialog` / `Menu` | ☐ |
| `screens/WinnerScreen.tsx` + `ui/Confetti.tsx` | `WinnerView` (Canvas/TimelineView-confetti) | ☐ (nu een eenvoudige winnaarskaart in `ScoringView`) |
| `screens/PlayersScreen.tsx`               | `PlayersView`            | ☐ |
| `SettingsSheet.tsx`                       | `SettingsView`           | ☐ |
| `hooks/useWakeLock.ts`                    | `UIApplication.shared.isIdleTimerDisabled` | ☐ |
| `InstallGuide` / `InstallPrompt` / `pwa.ts` | — alleen PWA            | n.v.t. |

Nog nodig:

- [ ] Fredoka-font bundelen (OFL-licentie) en registreren via `UIAppFonts`; `Theme.display` daarop laten wijzen
- [ ] App-icoon 1024×1024 zonder transparantie (vanaf `frontend/public/pwa-icon.svg`)
- [x] Haptics bij +/− en bij het einde van het spel
- [ ] Haptics bij het einde van de timer
- [x] Export uit de PWA (Instellingen → Exporteren naar iOS-app) en import in de iOS-app (deelmenu of bestandskiezer), zie `PWAImport.swift`

## Fase 2 — App Store

- [ ] Apple Developer-account, team-id in het project, App Store Connect-record
- [ ] Privacybeleid-URL (lokale data; straks ook account- en sync-data)
- [ ] Screenshots (6,9"), beschrijving (NL/EN), leeftijdsclassificatie
- [ ] TestFlight-beta

## Fase 3 — Sync (zie `backend/README.md`)

- [ ] Een `SyncService`-protocol in `PuntentellerKit`, met een implementatie die niets doet zolang er geen backend is
- [ ] Sign in with Apple, account verwijderen
- [ ] Uitnodigen via een share-link (Universal Link) → speler koppelen
- [ ] Spellen van anderen alleen-lezen tonen
