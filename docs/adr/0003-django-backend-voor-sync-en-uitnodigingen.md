# ADR-0003: Django-backend voor sync en uitnodigingen

- **Status:** Voorgesteld (nog niet gebouwd)
- **Datum:** 2026-10-16

## Context

Gebruikers willen dat hun spellen op meerdere toestellen te zien zijn. Ook
willen ze medespelers uitnodigen, zodat die de stand van gezamenlijke spellen op
hun eigen telefoon zien.

## Beslissing

- Er komt een backend in `backend/`, gebouwd met **Django + Django REST
  Framework** op PostgreSQL. Die wordt naast de PWA uitgerold met dezelfde
  Docker/Helm-aanpak.
- **Inloggen met Sign in with Apple** (verplicht in de App Store zodra er
  inloggen via een derde partij is). De backend controleert Apple's identity
  token en geeft een eigen token uit.
- **Local-first:** de app werkt zonder account. Sync is opt-in en gebruikt het
  model uit ADR-0002.
- **Rechten, v1:** alleen de eigenaar van een spel boekt punten. Gekoppelde
  spelers kunnen alleen lezen. Zo blijft conflictafhandeling simpel.
- **Uitnodigen** via een link of code (`Invite`) die bij één `Player` in één
  spel hoort. Wie accepteert, koppelt zijn account aan die speler.
- **Live meekijken:** eerst met polling of pull-to-refresh, later eventueel met
  push (APNs) of websockets.

Het API-ontwerp staat in `backend/README.md`.

## Gevolgen

- De iOS-app krijgt een sync-laag achter een protocol (`SyncService`). Die laag
  ontbreekt nu, zodat de app voorlopig zonder backend werkt.
- Een account vraagt om een privacybeleid, de mogelijkheid om je account te
  verwijderen (App Store-eis) en een privacylabel in App Store Connect.
