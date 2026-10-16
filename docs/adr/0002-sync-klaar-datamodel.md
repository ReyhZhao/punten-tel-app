# ADR-0002: Sync-klaar, local-first datamodel

- **Status:** Geaccepteerd
- **Datum:** 2026-10-16

## Context

Er komt een backend (ADR-0003) die spellen tussen toestellen synct en
uitgenodigde spelers de stand laat zien. De app moet offline volledig blijven
werken. Het huidige PWA-model is daar niet op ingericht:

- `Player.score` wordt opgeslagen náást het logboek: twee bronnen van waarheid
  die uit elkaar kunnen lopen als je wijzigingen samenvoegt.
- Undo, `resetScores` en `rematch` **verwijderen** boekingen. Een verwijdering is
  niet te syncen: een ander toestel ziet alleen dat er iets ontbreekt.
- `rematch` overschrijft een afgerond spel, zodat de uitslag verdwijnt.
  `SavedPlayer.wins` is een teller die per toestel ophoogt en niet samen te
  voegen is.
- Id's zijn korte random strings en tijden zijn epoch-milliseconden.

## Beslissing

Het iOS-model (`PuntentellerKit`) wordt vanaf het begin sync-klaar opgezet. De
backend neemt hetzelfde model over:

1. **Id's zijn UUID's** en worden op het toestel aangemaakt. Zo kun je offline
   records maken zonder botsingen.
2. **Het logboek is de bron van waarheid.** De stand is de som van de actieve
   boekingen. Een boeking verandert nooit meer, alleen `undoneAt` kan nog gezet
   worden.
3. **Niets wordt verwijderd, alleen gemarkeerd (tombstone).** Undo en reset
   zetten `undoneAt` op een boeking. Een spel verwijderen zet `deletedAt`.
4. **Opnieuw spelen maakt een nieuw spel** met dezelfde spelregels en spelers.
   Het oude spel blijft afgerond bewaard.
5. **Statistieken worden afgeleid** uit afgeronde spellen (`Statistics.wins`) en
   niet als teller opgeslagen.
6. **Elk record dat kan wijzigen heeft `updatedAt`.** Bij conflicten wint de
   laatste schrijver (last-writer-wins) op recordniveau. Boekingen kunnen niet
   botsen, omdat ze alleen worden toegevoegd.
7. **Spelers zijn koppelbaar aan een account:** `Player.accountId` blijft `nil`
   tot een uitgenodigde speler accepteert.
8. Tijden gaan als **ISO-8601 (UTC)** over de lijn.

Lokale UI-state (huidig scherm, timer, geselecteerde speler) hoort niet bij het
gesyncte model.

## Gevolgen

- Op iOS geeft "Opnieuw spelen" een nieuw spel in de lijst. Dat is bewust anders
  dan de PWA, die het spel overschrijft.
- `endTurnsLeft` blijft opgeslagen state (zoals in de PWA). Een undo zet die
  niet terug. Dat is gelijk aan de PWA en voorlopig acceptabel.
- Bij een import uit de PWA zijn niet alle overwinningen af te leiden: spellen
  die daar door "Opnieuw spelen" overschreven of verwijderd zijn, bestaan niet
  meer. Dat restant staat als `SavedPlayer.importedWins` (en per profiel
  `importedProfileWins`) en telt mee in `Statistics.wins`. Het is een eenmalige
  momentopname: bij een nieuwe import wordt hij overschreven, niet opgeteld.
- Wil de PWA later ook syncen, dan moet ze naar dit model migreren (UUID's,
  afgeleide stand, tombstones). Die migratie is met de bestaande `migrate*`-helpers
  in `store.ts` te doen.
