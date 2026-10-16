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

## Begrippen voor sync (zie `backend/` en ADR-0003)

| Begrip            | Code         | Betekenis |
|-------------------|--------------|-----------|
| **Account**       | `User` (backend) | Gebruiker van de backend: e-mailadres + schermnaam, zonder wachtwoord. Optioneel; zonder account werkt de app lokaal. |
| **Inlogcode**     | `LoginCode`  | 6-cijferige code per e-mail om je account te bevestigen of op een nieuw toestel in te loggen. |
| **Eigenaar**      | `owner`      | Account dat het spel heeft aangemaakt; wijzigt het spel en de spelers. |
| **Uitnodigen**    | `accountId` op `Player` | Een speler in een spel koppelen aan een account, gevonden via het exacte e-mailadres. Het spel is dan direct zichtbaar voor dat account. |
| **Deelnemer**     | gekoppelde `Player` | Uitgenodigd account; ziet het spel en de uitslag. |
| **Deelnemers mogen scores bijhouden** | `participantsCanScore` | Instelling per spel: deelnemers mogen dan ook boeken. |
| **Spel verlaten** | `leave`      | Een deelnemer haalt zichzelf uit een gedeeld spel. |
| **Eigenaar overdragen** | `transfer` | De eigenaar maakt een uitgenodigde speler eigenaar; zelf blijft hij meespelen. |
| **Sync**          | `POST /api/v1/sync` | Eigen wijzigingen sturen en die van anderen ophalen, vanaf een cursor. |
