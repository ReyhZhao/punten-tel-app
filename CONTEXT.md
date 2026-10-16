# Domeintaal — Puntenteller

Begrippen die in de PWA (`frontend/`), de iOS-app (`ios/`) en de toekomstige
backend (`backend/`) dezelfde betekenis hebben. In de UI is de taal Nederlands;
in code gebruiken we de Engelse naam uit de tweede kolom.

| Begrip (UI)        | Code            | Betekenis |
|--------------------|-----------------|-----------|
| **Spel**           | `Game`          | Eén potje dat gespeeld wordt: naam, spelregels, deelnemers en het puntenlogboek. Is *lopend* of *afgerond*. |
| **Speler** (in een spel) | `Player`  | Deelnemer aan één spel, met naam en kleur. De stand wordt afgeleid uit het logboek. |
| **Bewaarde speler** | `SavedPlayer`  | Speler die op dit toestel onthouden wordt om snel opnieuw te kiezen, met gewonnen spellen als statistiek. |
| **Spelprofiel**    | `GameProfile`   | Opgeslagen set spelregels met een naam (bv. "Rummikub") om snel een nieuw spel van te starten. |
| **Spelregels**     | `GameRules`     | Hoe een spel gespeeld wordt: wie wint (`Scoring`), timer, max score, max rondes, eindmodus, sorteren. |
| **Wie wint**       | `Scoring`       | `high` = hoogste score wint, `low` = laagste score wint. |
| **Boeking**        | `ScoreEntry` (web: `LogEntry`) | Eén score-actie: speler + delta (mag 0 zijn) + tijdstip. Het logboek is de bron van waarheid voor de stand. |
| **Ongedaan maken** | `undo`          | Een boeking intrekken. De stand wordt hersteld. |
| **Beurt**          | —               | Eén boeking van een speler. Een boeking van 0 punten telt ook als beurt. |
| **Ronde**          | —               | Elke speler heeft één beurt gehad (aantal boekingen ÷ aantal spelers). |
| **Max score**      | `maxScore`      | Score waarbij het einde van het spel wordt ingezet. |
| **Max rondes**     | `maxRounds`     | Harde grens: na zoveel rondes is het spel afgelopen, wat er ook gebeurt. |
| **Eindmodus**      | `EndMode`       | Wat er gebeurt bij het bereiken van de max score: `immediate` (direct stoppen), `round` (ronde afmaken: alleen spelers ná de trigger), `extraTurn` (alle andere spelers krijgen nog één beurt). |
| **Leider**         | `leaders`       | Speler(s) met de beste stand. Wordt pas getoond na de eerste boeking. |
| **Winnaar**        | `winner`        | Nummer één van de ranglijst als het spel afgerond is. |
| **Opnieuw spelen** | `rematch`       | Nieuw spel met dezelfde spelregels en spelers. |

## Begrippen voor sync (gepland, zie `backend/`)

| Begrip            | Code         | Betekenis |
|-------------------|--------------|-----------|
| **Account**       | `Account`    | Een gebruiker van de backend (Sign in with Apple). |
| **Eigenaar**      | `owner`      | Account dat het spel heeft aangemaakt; alleen de eigenaar boekt punten. |
| **Uitnodiging**   | `Invite`     | Link of code waarmee een speler zijn account aan een `Player` in een spel koppelt. |
| **Gekoppelde speler** | `Player.accountId` | Speler in een spel die bij een account hoort; die ziet het spel en de stand op zijn eigen toestel. |
