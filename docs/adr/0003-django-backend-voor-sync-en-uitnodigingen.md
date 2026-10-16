# ADR-0003: Django-backend voor sync en uitnodigingen

- **Status:** Geaccepteerd (herzien 2026-10-16)
- **Datum:** 2026-10-16

## Context

Gebruikers willen dat hun spellen op meerdere toestellen te zien zijn. Ook
willen ze medespelers uitnodigen, zodat die de uitslag van gezamenlijke spellen
op hun eigen telefoon zien en desgewenst zelf scores bijhouden.

## Beslissing

- De backend staat in `backend/`: **Django 5.2 (LTS) + Django REST Framework**
  op PostgreSQL. Hij draait op **hetzelfde domein als de PWA**
  (`punten.vels.online`): de ingress stuurt `/api/` en `/admin/` naar de
  backend en al het andere naar de PWA.
- **Optioneel en local-first:** de app werkt zonder account. Sync start pas
  als je een account aanmaakt, en gebruikt het model uit ADR-0002.
- **Account met alleen e-mail en schermnaam, zonder wachtwoord.** Bevestigen
  en inloggen op een nieuw toestel gaat met een **6-cijferige code** per
  e-mail (15 minuten geldig, maximaal 5 pogingen). Elk toestel krijgt een
  eigen token. Codes en tokens worden alleen als HMAC-hash opgeslagen. De mail
  gaat via SMTP; de instellingen komen uit env-variabelen.
- **Uitnodigen door op het exacte e-mailadres te zoeken** (`accounts/lookup`).
  Dat geeft alleen het account-id en de schermnaam terug, nooit het
  e-mailadres, en is begrensd per gebruiker. De app bewaart het account-id
  lokaal bij de bewaarde speler (`SavedPlayer.accountId`), zodat je die
  speler daarna direct uitnodigt. Uitnodigen is een speler in het spel
  koppelen aan dat account.
- **Een gedeeld spel is direct zichtbaar** bij de uitgenodigde, zonder
  accepteren. Die kan zichzelf eruit halen (`games/{id}/leave`).
- **Rechten:** de eigenaar wijzigt het spel en de spelers. Gekoppelde spelers
  zien het spel alleen, tenzij de eigenaar **"deelnemers mogen scores
  bijhouden"** (`participantsCanScore`) aanzet. Dan mogen ze boeken, boekingen
  ongedaan maken en de spelstatus bijwerken (einde van het spel).
- **Spelprofielen** syncen tussen je eigen toestellen. Bij een gedeeld spel
  krijgen deelnemers het profiel alleen-lezen mee.
- **Sync** via één endpoint met een cursor. Een globale revisieteller zorgt
  dat de volgorde klopt. Toegangs-events zorgen dat nieuwe deelnemers het hele
  spel krijgen en dat vertrokken deelnemers het spel kwijtraken. Details in
  `backend/README.md`.

### Vervallen ten opzichte van de eerste versie

- *Sign in with Apple* → e-mail met code. Daarmee werkt het ook buiten iOS,
  en is een account niet aan een Apple ID gebonden. De App Store vereist
  Sign in with Apple alleen bij inloggen via derde partijen, en daar is hier
  geen sprake van.
- *Uitnodigen met een link of code* → zoeken op e-mailadres.
- *Alleen de eigenaar boekt* → instelbaar per spel.

## Gevolgen

- Omdat meerdere toestellen tegelijk kunnen boeken, is het append-only
  logboek (ADR-0002) nu echt nodig. Boekingen botsen nooit, alleen de
  spelstatus volgt last-writer-wins.
- **Rate limiting** gebruikt een cache in het geheugen. Daarom draait de
  backend met één replica; opschalen vraagt om Redis (of iets vergelijkbaars).
- **Mailbezorging hangt af van de SMTP-instellingen.** Zorg voor SPF/DKIM op
  het afzenderdomein, anders komen codes in de spam terecht.
- **De App Store vereist dat je je account in de app kunt verwijderen.**
  Daarvoor is er `DELETE /api/v1/me`. Deelnemers verliezen dan de spellen van
  dat account.
- **iOS-app en PWA** hebben dezelfde sync-logica: `Sync.swift` en
  `frontend/src/sync.ts`. Ze syncen bij openen, elke 20 seconden op de
  voorgrond, kort na een wijziging, en met pull-to-refresh (iOS).
- **Nog niet gebouwd:** meldingen (push) bij een nieuw gedeeld spel.
