# Handoff: Puntenteller — score-app voor bordspellen (iOS / Android PWA)

## Overview
Een mobiele app om punten bij te houden tijdens het spelen van bordspellen. Gebruikers maken **spellen** aan, voegen **spelers** toe en tellen tijdens het spel punten op of af. De app onthoudt lopende spellen (opslaan & hervatten), houdt een **historie met undo** bij, heeft een optionele **timer per beurt** en toont aan het einde een **winnaar-scherm** met podium.

Doelplatform: **iOS en Android**, uitgevoerd als **PWA**. De prototype is ontworpen met een **iOS-native look-and-feel** (status bar, dynamic island, liquid-glass elementen, SF-achtige systeemtypografie + speels rond display-font).

## About the Design Files
De bestanden in `prototype/` zijn **ontwerpreferenties, gemaakt in HTML/React (Babel-in-browser)**. Ze laten het bedoelde uiterlijk en gedrag zien — het is **geen productiecode om letterlijk over te nemen**. De taak is om deze ontwerpen **na te bouwen in de doel-codebase** met de daar gangbare patronen en libraries.

Aanbevolen implementatie (geen bestaande codebase aanwezig): bouw als **PWA** met een modern framework — bijv. **React + Vite + TypeScript** met `vite-plugin-pwa`, of **Next.js**. State + persistentie kan met React state + `localStorage` (zoals het prototype) of een lichte store (Zustand). Voor een echt native gevoel op beide platforms is dit prima als geïnstalleerde PWA; native (SwiftUI / Jetpack Compose) kan ook maar is niet vereist.

> De prototype gebruikt 3 schakelbare thema's. **De gekozen richting voor productie is het "Confetti"-thema (licht).** De thema's "Arcade" (donker/neon) en "Pastel" zijn optioneel en hoeven in v1 niet meegenomen te worden — implementeer Confetti als de vaste stijl, eventueel met dark mode later.

## Fidelity
**High-fidelity (hifi).** Kleuren, typografie, spacing, radii, schaduwen en interacties zijn definitief uitgewerkt. Bouw de UI pixel-nauwkeurig na met het Confetti-token-set hieronder. De iOS device-bezel (`frames/ios-frame.jsx`) is **presentatie-chroom** voor de prototype — in de echte app NIET nabouwen; gebruik het echte device-scherm.

---

## Design Tokens — "Confetti" (productie-thema)

### Kleuren
| Token | Hex | Gebruik |
|---|---|---|
| `bg` | `#FAF6EE` | Scherm-achtergrond (warm crème/papier) |
| `stage` | `#ECE6DA` | Backdrop achter het toestel (alleen prototype) |
| `surface` | `#FFFFFF` | Kaarten, rijen, bedieningsbalk |
| `surface2` | `#F3ECDF` | Secundair vlak: segmented control, chips, knop-soft, − knop |
| `text` | `#28231D` | Primaire tekst |
| `muted` | `#9C9384` | Secundaire tekst / labels |
| `faint` | `#C9C0B0` | Tertiair: chevrons, placeholders, uitgeschakelde toggle |
| `accent` | `#FF5A3C` | Primaire actie (vermiljoen): + knop, Start, leiders-score |
| `accentText` | `#FFFFFF` | Tekst/iconen op accent |
| `border` | `rgba(40,35,29,0.08)` | Kaartrand |
| `sep` | `rgba(40,35,29,0.07)` | Scheidingslijnen |

### Semantische / vaste kleuren
| Doel | Hex |
|---|---|
| Positief / toevoegen (+N, "Start"-toggle aan) | `#34C759` |
| Negatief / aftrekken (−N) | `#FF453A` |
| Goud (1e plek / trofee-badge) | `#F4B400` |
| Zilver (2e plek) | `#C7CBD1` |
| Brons (3e plek) | `#CD7F4D` |

### Speler-kleuren (vaste palet, in volgorde toegekend)
Bij toevoegen krijgt speler *i* kleur `PLAYER_COLORS[i % 8]`:
```
#FF5A5F (koraal) · #FF8A3D (oranje) · #F4B400 (amber) · #34C759 (groen)
#00C2C7 (teal)  · #4D8DFF (blauw)  · #8B6CFF (violet) · #FF6FB5 (roze)
```

### Typografie
- **Display / koppen / cijfers / knoppen:** `Fredoka` (Google Font), gewichten 400/500/600/700. Rond, speels.
- **UI / body / inputs:** systeem-stack `-apple-system, system-ui, sans-serif`.
- Cijfers (scores, timer): `font-variant-numeric: tabular-nums`.

| Rol | Font | Size | Weight | Bijzonderheden |
|---|---|---|---|---|
| Groot scherm-titel ("Spellen") | Fredoka | 38 | 700 | line-height 1.05 |
| Eyebrow ("PUNTENTELLER") | Fredoka | 13 | 600 | uppercase, letter-spacing 1.5, kleur `accent` |
| Kaart-/sectietitel | Fredoka | 18–20 | 600 | |
| Speler-naam (lijst) | Fredoka | 18 | 600 | |
| Score (lijst) | Fredoka | 30 | 700 | tabular-nums |
| Bedieningsbalk cijfer (aantal) | Fredoka | 44 | 700 | |
| Winnaar-score | Fredoka | 44 | 700 | kleur `accent` |
| Label/caption | system | 11.5–13 | 600–700 | uppercase labels: letter-spacing ~0.6 |
| Body/meta | system | 13–16.5 | 400–500 | |

### Radius
- Kaarten: **22px** · Bedieningsbalk: 22px · Lijst-rijen: 18px · Knoppen lg/md/sm: 16/14/12 · +/− grote knoppen: **20px** · Chips/pills: 9999px · Segmented control track: 15px, thumb 12px · Bottom sheet: 26px (top corners) · Avatar: rond.

### Schaduw
- `shadow` (licht): `0 1px 2px rgba(40,35,29,0.05), 0 8px 24px rgba(40,35,29,0.07)`
- Geselecteerde spelerrij: `0 4px 18px {spelerkleur}33` (33 = ~20% alpha)
- Avatar krijgt subtiele inset: `inset 0 -2px 6px rgba(0,0,0,0.14)`

### Spacing
Schermranden 16–22px. Verticale gaps tussen kaarten 9–14px. Rij-padding ~12–16px. Veilige bovenmarge voor status bar in prototype = 52px (in echte app: gebruik safe-area insets).

---

## Screens / Views

### 1. Home — "Spellen"
**Doel:** overzicht van alle (lopende & afgeronde) spellen; nieuw spel starten.

**Layout (verticaal):**
- **Header** (padding 22px): links eyebrow "PUNTENTELLER" (accent) + grote titel "Spellen"; rechts een 52×52 afgerond vierkant (radius 16) in `accent` met dobbelsteen-icoon.
- **Lijst** van spel-kaarten (gap 14), gesorteerd op `lastPlayed` (nieuwste eerst). Elke kaart (radius 22, `surface`):
  - Bovenste deel (padding 16/18): spelnaam (Fredoka 20/600) + optioneel badge "KLAAR" (als afgerond); daaronder meta-rij: pijl-icoon ↑/↓ (accent) + "Hoogste/Laagste wint" · relatieve tijd. Rechts chevron (faint).
  - Onderste strook (`surface2`, padding 12/18): links overlappende speler-avatars (30px, −10px marge, witte ring), bij >6 "+N"; rechts trofee-icoon (goud) + naam leider + score (accent) — of "N spelers" als er nog niets geboekt is.
- **Lege staat** (geen spellen): gecentreerd dobbelsteen-icoon in `surface2`-vierkant (96px, radius 30), "Nog geen spellen", uitlegtekst.
- **Vaste onderbalk** met fade-gradient naar `bg`: volledige-breedte primaire knop "**+ Nieuw spel**".

### 2. Nieuw spel
**Doel:** spel configureren en spelers toevoegen.

**Layout:** header met X (sluiten, links), gecentreerde titel "Nieuw spel". Scrollende form (gap 22):
- **Naam van het spel** — label (uppercase, muted) + tekst-input (hoogte 54, radius 16, `surface`, rand `border`), placeholder "bijv. Spelavond, Rummikub…".
- **Wie wint?** — segmented control (track `surface2`, radius 15, padding 5) met 2 segmenten: "↑ Hoogste wint" / "↓ Laagste wint". Actief segment = `surface` kaartje met schaduw, icoon in accent.
- **Timer per beurt** — label + iOS-toggle (52×31, aan = `#34C759`, uit = `faint`). Indien aan: rij met 4 chips `30s / 45s / 60s / 90s`; geselecteerde chip = `accent` met `accentText`.
- **Spelers** — label + teller "n/8" (accent bij 8). Lijst toegevoegde spelers: rij (`surface`, radius 16) met avatar + naam + prullenbak-knop. Daaronder (zolang <8) een toevoeg-rij (`surface2`): persoon-icoon + naam-input (placeholder "Naam speler toevoegen", Enter = toevoegen) + ronde + knop (accent als er tekst staat, anders faint/disabled).
- **Vaste onderbalk:** knop "**⚑ Start spel**", disabled tot er een naam is én ≥2 spelers; anders helptekst eronder.

### 3. Score tellen (kernscherm)
**Doel:** punten op/aftellen per speler.

**Layout:**
- **Header:** terug-chevron (links) · gecentreerd spelnaam + "Hoogste/Laagste wint" (klein, muted) · historie-icoon (lijst) · ellipsis-menu.
- **Bedieningsbalk (BOVENIN — dit is een expliciete eis):** kaart (`surface`, radius 22) met:
  - Regel "Punten voor" + chip met avatar (22px) + naam van de **geselecteerde** speler.
  - Rij met 3 elementen: **− knop** (64×64, radius 20, `surface2`, icoon `#FF453A`), **invoerveld** in het midden (groot getal, Fredoka 44/700, gecentreerd, `inputmode=numeric`, default `1`, label "AANTAL PUNTEN" eronder), **+ knop** (64×64, radius 20, `accent`, icoon `accentText`).
  - Druk op + telt het ingevoerde aantal op bij de geselecteerde speler; − trekt het af. (Positie boven/onder is in het prototype een tweak; **productie = boven**.)
- **Spelerslijst** (scrollt): live gesorteerd op stand (hoog/laag afhankelijk van `scoring`). Elke rij (radius 18):
  - Avatar (44px); leider(s) krijgen een goud trofee-badge rechtsboven de avatar.
  - Naam (Fredoka 18/600); als geselecteerd: subtekst "geselecteerd" in spelerkleur.
  - Score (Fredoka 30/700) met **pop-animatie** bij wijziging; zwevende **+N/−N** feedback (groen/rood) die omhoog fade't.
  - **Tik op een rij = selecteer die speler.** Geselecteerde rij: 2px rand in spelerkleur + zachte gekleurde schaduw.
- **Timer-kaart** (alleen als timer aan, boven de lijst): avatar + "AAN DE BEURT" + spelernaam + grote afteltijd (m:ss), voortgangsbalk, en knoppen Reset / Start-Pauze / **Volgende**. Bij ≤5s en 0 wordt tijd/balk rood; bij 0 schudt de kaart kort. "Volgende" gaat naar de volgende speler in lijstvolgorde, reset de tijd en selecteert die speler.

### 4. Historie (bottom sheet)
**Doel:** alle boekingen bekijken en ongedaan maken.

Bottom sheet (radius 26 boven, max-hoogte 80%, grijp-handle bovenaan, X rechts). Lijst nieuwste-eerst: per entry avatar + naam + relatieve tijd, rechts de delta (`+N` groen / `−N` rood, Fredoka 19/700) en een **undo-knop** die díe boeking verwijdert en de score corrigeert. Lege staat met lijst-icoon.

### 5. Winnaar
**Doel:** uitslag vieren.

Volledig scherm met **confetti** (vallende gekleurde stukjes, oneindige animatie) en lichte gradient bovenin. Centraal: eyebrow "WINNAAR" (accent), grote avatar (92px) van de winnaar, naam (Fredoka 32/700), score (Fredoka 44/700, accent) + "punten". **Podium** voor top 3 in volgorde 2-1-3, met staaf-hoogtes 88/120/68px, medaille-cirkel (goud/zilver/brons) met rangnummer en score. Onder top-3 een **ranglijst** voor plek 4+. Onderaan: knop "**↻ Opnieuw spelen**" (rematch) + soft-knop "Terug naar spellen".

---

## Interactions & Behavior
- **Speler selecteren:** tik op spelerrij → `selectedId`. Standaard de eerste speler (of de beurt-speler bij actieve timer).
- **Punten boeken:** + / − past `amount` toe op `selectedId`; voegt log-entry toe; triggert pop + zwevende delta. Leeg/0 aantal = geen actie.
- **Aantal invoeren:** numeriek veld, gefilterd op cijfers, max 4 tekens; focus selecteert de waarde. Default `1`.
- **Undo:** verwijder willekeurige log-entry → score = score − delta. Veilig omdat alle mutaties additieve deltas zijn (volgorde-onafhankelijk).
- **Timer:** 1s-tick wanneer `running`; stopt op 0. "Volgende" rouleert `turnIdx = (turnIdx+1) % players.length`. (Geen geluid in prototype — overweeg een korte beep/trilling bij 0 in productie.)
- **Spel beëindigen** (ellipsis → "Beëindig spel & toon winnaar"): `finished = true`, navigeer naar Winnaar.
- **Opnieuw spelen** (rematch): scores → 0, log gewist, `finished = false`, terug naar Score-scherm.
- **Scores resetten / Spel verwijderen:** via ellipsis-menu (iOS action sheet met "Annuleer").
- **Animaties:** `pop` 0.25s (score), `floatUp` 0.9s (delta), `confettiFall` 2.4–4.6s linear infinite, `sheetUp` ~0.3s cubic-bezier(.2,.9,.3,1) (sheets), `shake` 0.4s (timer op 0). Knoppen: `scale(0.92–0.96)` op pointer-down.

## State Management
Eén bron van waarheid, gepersisteerd in `localStorage` (key `pwa-punten-v2`):
```ts
type Player = { id: string; name: string; color: string; score: number };
type LogEntry = { id: string; playerId: string; delta: number; ts: number };
type Game = {
  id: string; name: string;
  scoring: 'high' | 'low';
  timerOn: boolean; timerSecs: number;      // 30 | 45 | 60 | 90
  players: Player[];                          // 2–8
  log: LogEntry[];
  createdAt: number; lastPlayed: number; finished: boolean;
};
type AppState = { games: Game[]; screen: 'home'|'new'|'scoring'|'winner'; currentId: string|null };
```
Acties: `createGame`, `openGame`, `applyScore(gameId, playerId, delta)`, `undoLog(gameId, logId)`, `finishGame`, `rematch`, `resetScores`, `deleteGame`. Scherm + huidig spel worden óók gepersisteerd zodat herladen de plek bewaart. Lokale (niet-gepersisteerde) UI-state op het score-scherm: `amount`, `selectedId`, `turnIdx`, `remaining`, `running`, sheet/menu-open.

**Ranking:** `scoring === 'low'` → oplopend, anders aflopend. Leider(s) = alle spelers met de beste score (alleen tonen zodra `log.length > 0`).

## Assets
- **Iconen:** allemaal inline SVG (zie `Icon` in `theme.jsx`): plus, minus, back, chevR/chevD, x, check, trophy, clock, undo, trash, ellipsis, dice, flag, play, pause, reset, up, down, person, grip, spark, list. Gebruik in de doel-codebase de eigen icon-set (bijv. lucide/SF Symbols) met dezelfde betekenis.
- **Fonts:** Fredoka via Google Fonts; body = systeemfont. Geen afbeeldingen of merk-assets.
- **Confetti & podium:** puur CSS/JS, geen assets.

## Files (in `prototype/`)
- `Puntenteller.html` — entry; laadt fonts, React 18, Babel, scripts; bevat CSS keyframes (`confettiFall`, `floatUp`, `pop`, `fadeIn`, `sheetUp`, `shake`).
- `theme.jsx` — **design tokens** (`THEMES`, `PLAYER_COLORS`), helpers (`uid`, `relTime`), `Icon`, primitives (`Btn`, `IconBtn`, `Card`).
- `screens.jsx` — `PlayerAvatar`, `Confetti`, `HomeScreen`, `NewGameScreen`, `WinnerScreen`.
- `game.jsx` — `ScoringScreen` (kern), `TurnTimer`, `HistorySheet`, `ActionSheet`.
- `app.jsx` — root: state, persistentie, acties, schaling, Tweaks-panel + voorbeelddata (`seedGames`).
- `tweaks-panel.jsx`, `frames/ios-frame.jsx` — **alleen prototype-chroom** (thema-wisselaar resp. iOS-bezel); niet nodig in productie.

## Open punten / aanbevelingen voor v1
- PWA-manifest + icoon + offline (service worker) toevoegen; safe-area insets i.p.v. vaste 52px topmarge.
- Confetti vastzetten als enige thema (dark mode optioneel later).
- Overweeg geluid/trilling bij timer-einde en eventueel rondes/kolommen per ronde (nu één doorlopende stand).
