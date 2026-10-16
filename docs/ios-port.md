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
| `store.ts` — opslag in `localStorage`     | `GameStore` (@Observable) + JSON-bestand in Application Support | ☐ |
| `screens/HomeScreen.tsx`                  | `HomeView`               | ◐ lege staat |
| `screens/NewGameScreen.tsx` (+ profielen) | `NewGameView`            | ☐ |
| `screens/ScoringScreen.tsx`               | `ScoringView`            | ☐ |
| `game/TurnTimer.tsx`                      | `TurnTimerView`          | ☐ |
| `game/HistorySheet.tsx`                   | `.sheet` met `HistoryView` | ☐ |
| `game/ActionSheet.tsx`                    | `.confirmationDialog` / `Menu` | ☐ |
| `screens/WinnerScreen.tsx` + `ui/Confetti.tsx` | `WinnerView` (Canvas/TimelineView-confetti) | ☐ |
| `screens/PlayersScreen.tsx`               | `PlayersView`            | ☐ |
| `SettingsSheet.tsx`                       | `SettingsView`           | ☐ |
| `hooks/useWakeLock.ts`                    | `UIApplication.shared.isIdleTimerDisabled` | ☐ |
| `InstallGuide` / `InstallPrompt` / `pwa.ts` | — alleen PWA            | n.v.t. |

Nog nodig:

- [ ] Fredoka-font bundelen (OFL-licentie) en registreren via `UIAppFonts`; `Theme.display` daarop laten wijzen
- [ ] App-icoon 1024×1024 zonder transparantie (vanaf `frontend/public/pwa-icon.svg`)
- [ ] Haptics bij +/− en bij het einde van de timer (iOS-meerwaarde)
- [ ] Export uit de PWA en import in de iOS-app, zodat bestaande spellen mee kunnen (JSON omzetten naar het model uit ADR-0002)

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
