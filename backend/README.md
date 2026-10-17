# Backend

Django-API voor het delen van spellen en spelprofielen tussen toestellen en
spelers. Besluiten: [ADR-0002](../docs/adr/0002-sync-klaar-datamodel.md)
(datamodel) en [ADR-0003](../docs/adr/0003-django-backend-voor-sync-en-uitnodigingen.md)
(backend).

- Python 3.13, Django 5.2 LTS, Django REST Framework, PostgreSQL 17
- Draait onder uvicorn (ASGI), nodig voor de realtime-stream (SSE)
- Draait op hetzelfde domein als de PWA: `https://punten.vels.online/api/…`
- Image `registry.vels.online/punten/api`, release-tags `api-vX.Y.Z`

```
backend/
  puntenteller/   # instellingen, urls, health-check
  accounts/       # account, inlogcodes, tokens, /me
  games/          # Game, Player, ScoreEntry, GameProfile, sync, uitnodigen
  notifications/  # pushmeldingen (Apple Push Notification service)
```

## Lokaal ontwikkelen

```sh
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
export DJANGO_DEBUG=1                       # SQLite, mails in de console
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver        # http://localhost:8000/api/v1/
.venv/bin/python manage.py test
```

Of met PostgreSQL via Docker, vanuit de repo-root: `docker compose up api`.

Beheer: `python manage.py createsuperuser`, daarna `/admin/`.

## API (v1)

Na het inloggen stuur je bij elk verzoek `Authorization: Bearer <token>` mee.
Fouten hebben de vorm `{"code": "...", "detail": "..."}`; `detail` is
Nederlands en geschikt om te tonen.

### Account

| Methode | Pad | Doel |
|---------|-----|------|
| `POST` | `/api/v1/auth/request-code` | `{email, displayName?}`: mailt een 6-cijferige code. Nieuw e-mailadres zonder `displayName` geeft `404 account_not_found`; de app toont dan het aanmeldformulier. Antwoord: `{sent, newAccount}` |
| `POST` | `/api/v1/auth/verify` | `{email, code, deviceName?}` → `{token, account}`. Fouten: `invalid_code`, `code_expired`, `too_many_attempts` |
| `POST` | `/api/v1/auth/logout` | Token van dit toestel intrekken |
| `GET` / `PATCH` | `/api/v1/me` | `{id, email, displayName}`; alleen `displayName` is te wijzigen |
| `DELETE` | `/api/v1/me` | Account en eigen spellen verwijderen (App Store-eis) |
| `POST` | `/api/v1/me/invite-code` | Nieuwe uitnodigcode: `{code, expiresAt}`, 6 cijfers, 10 minuten geldig; de vorige vervalt. Alleen voor bevestigde accounts |

Codes zijn 15 minuten geldig, met maximaal 5 pogingen per code en 5 codes per
e-mailadres per uur. Daarnaast geldt een limiet per IP-adres.

### Uitnodigen

| Methode | Pad | Doel |
|---------|-----|------|
| `POST` | `/api/v1/push/devices` | `{token, environment}` (`sandbox` of `production`): toestel aanmelden voor pushmeldingen. Gekoppeld aan het login-token; uitloggen meldt het toestel af |
| `DELETE` | `/api/v1/push/devices/{token}` | Toestel afmelden |
| `GET` | `/api/v1/events` | Realtime-stream (Server-Sent Events): `event: change` met `data: <cursor>` zodra iets verandert in een spel waar je toegang toe hebt (of toe had); elke 20 s een keep-alive. Krijg je een cursor die hoger is dan je eigen cursor, doe dan een sync. Via de stream gaan geen gegevens |
| `POST` | `/api/v1/accounts/lookup` | `{email}` of `{code}` (uitnodigcode) → `{id, displayName}`, alleen bij een exacte match met een bevestigd account. Onbekende code: `404 invite_code_not_found`. De app bewaart `id` als `SavedPlayer.accountId` |
| `POST` | `/api/v1/games/{id}/leave` | Jezelf uit een gedeeld spel halen |
| `POST` | `/api/v1/games/{id}/transfer` | Eigenaar: `{accountId, ownerPlayerId?}` draagt het spel over aan een gekoppelde speler. Ben je zelf nog niet aan een speler gekoppeld, geef dan met `ownerPlayerId` aan welke speler jij bent (anders `400 owner_player_required`), zodat je het spel blijft zien |

Uitnodigen gaat via de sync: de eigenaar zet `accountId` op een speler.
Ontkoppelen doet hij door `accountId` weer op `null` te zetten.

### Sync

`POST /api/v1/sync`

```jsonc
// verzoek
{
  "cursor": 1234,              // null bij de eerste sync
  "changes": {                 // alles optioneel
    "gameProfiles": [{ "id", "name", "rules", "updatedAt", "deletedAt" }],
    "games":        [{ "id", "name", "profileId", "rules", "endTurnsLeft", "participantsCanScore",
                       "createdAt", "updatedAt", "finishedAt", "deletedAt" }],
    "players":      [{ "id", "gameId", "name", "color", "position", "accountId", "updatedAt" }],
    "scoreEntries": [{ "id", "gameId", "playerId", "delta", "createdAt", "undoneAt" }]
  }
}
// antwoord
{
  "cursor": 1240,              // bewaren voor de volgende sync
  "changes": { … },            // alles wat sinds `cursor` zichtbaar voor jou veranderd is
                               // (+ "ownerId" bij games/profielen, "createdBy" bij boekingen)
  "removedGameIds": ["…"],     // spellen waar je geen toegang meer toe hebt: lokaal weghalen
  "accounts": [{ "id", "displayName" }],  // namen van eigenaren en gekoppelde spelers
  "rejected": [{ "type", "id", "reason" }] // niet toegepast: forbidden, unknown_game, unknown_account, …
}
```

`rules` heeft dezelfde vorm als `GameRules` in de iOS-app. Tijden zijn
ISO-8601 in UTC.

Regels:

- **Conflicten:** last-writer-wins op `updatedAt` per record. Een ouder record
  wordt stil genegeerd.
- **Boekingen** worden alleen toegevoegd. Daarna kan alleen `undoneAt` nog
  gezet worden.
- **Eigenaar:** wijzigt het spel, de spelers en de koppelingen.
- **Deelnemers:** zien het spel. Met `participantsCanScore` mogen ze ook
  boeken, boekingen ongedaan maken en `endTurnsLeft`/`finishedAt` bijwerken.
- **Gedeelde spellen:** wie toegang krijgt, ontvangt het hele spel, ook
  oudere boekingen. Wie toegang verliest, krijgt het spel in `removedGameIds`.
- **Antwoord:** bevat ook je eigen wijzigingen, met wat de server ervan maakte.
  Pas het antwoord toe als de waarheid.

De cursor is een revisienummer uit één teller. Schrijvende syncs wachten op
elkaar via een rij-lock, zodat revisies in volgorde zichtbaar worden. Bij
deze schaal is dat ruim voldoende.

## Uitrol

De Helm-chart in `deployment/` rolt PWA en backend uit onder één ingress
(`host` in `values.yaml`), met PostgreSQL via
[CloudNativePG](https://cloudnative-pg.io/):

| Pad | Naar |
|-----|------|
| `/api/` | backend (`punten-api:8000`), inclusief `/api/static/` voor de admin |
| `/admin/` | backend |
| `/` | PWA |

De service worker van de PWA laat `/api` en `/admin` met rust
(`navigateFallbackDenylist`).

**Database:** de chart maakt een CNPG-`Cluster` `punten-db` aan. De
CNPG-operator moet dus in het cluster draaien. CNPG maakt zelf de Secret
`punten-db-app` aan, en de backend leest daaruit host, poort, database,
gebruiker en wachtwoord. Wil je een bestaand CNPG-cluster gebruiken? Zet dan
`postgres.createCluster: false` en geef `postgres.clusterName` die naam; het
cluster moet in dezelfde namespace staan.

**Secrets:** `DJANGO_SECRET_KEY` en `EMAIL_HOST_PASSWORD` komen uit Vault
(`kv/puntenteller`). De ExternalSecret in de chart zet ze in de Secret
`backend-secret` (`api.existingSecret`). Zet die twee waarden dus eenmalig in
Vault, bijvoorbeeld:

```sh
vault kv put kv/puntenteller \
  DJANGO_SECRET_KEY="$(openssl rand -base64 48)" \
  EMAIL_HOST_PASSWORD='<smtp-wachtwoord>'
```

De SMTP-server staat in `api.email` in `values.yaml`.

Een release maak je met de tag `api-vX.Y.Z`. De workflow `release-api.yml`
test, bouwt en pusht de image en zet `api.image.tag` in `values.yaml`.
Migraties draaien als initContainer vóór de app start. Tot CNPG de database en
de Secret klaar heeft, wacht de pod vanzelf.

### Omgevingsvariabelen

| Variabele | Standaard | |
|-----------|-----------|---|
| `DJANGO_SECRET_KEY` | — | verplicht (behalve met `DJANGO_DEBUG=1`) |
| `DJANGO_DEBUG` | `0` | lokaal `1`: SQLite (zonder `POSTGRES_HOST`) en mails in de console |
| `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS` | — | komma-gescheiden |
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | `—, 5432, puntenteller, puntenteller, —` | zonder host: SQLite. In de chart: uit de CNPG-Secret |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` | `localhost, 587, —, —, true` | SMTP |
| `DEFAULT_FROM_EMAIL` | `Puntenteller <noreply@vels.online>` | |
| `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_TOPIC` | `—, —, —, online.vels.puntenteller` | pushmeldingen; zonder sleutel uit |
| `THROTTLE_AUTH`, `THROTTLE_LOOKUP` | `20/hour`, `30/hour` | per IP resp. per gebruiker |

### Pushmeldingen

Meldingen gaan alleen bij momenten die ertoe doen als de app dicht is: je bent
toegevoegd aan een spel, een spel waarin je meedoet is afgelopen (met de
winnaar), of een spel is aan jou overgedragen. Wie de actie zelf uitvoert,
krijgt geen melding. Ze gaan na de commit, in een achtergrond-thread, direct
naar Apple (HTTP/2, token-authenticatie). Toestellen die Apple als ongeldig
meldt, worden opgeruimd. Zonder sleutel staat push uit; de rest werkt gewoon.

**Eenmalig instellen:**

1. Maak in het Apple Developer-account onder *Certificates, Identifiers &
   Profiles → Keys* een sleutel aan met **Apple Push Notifications service
   (APNs)**. Download de `.p8` (dat kan maar één keer) en noteer de *Key ID*.
2. Zet de inhoud van de `.p8` in Vault:
   `vault kv patch kv/puntenteller APNS_PRIVATE_KEY=@AuthKey_XXXXXXXXXX.p8`
3. Vul `api.push.keyId` in `deployment/values.yaml` in. `teamId` en `topic`
   (bundle-id) staan er al. De chart maakt dan de ExternalSecret
   `backend-apns-secret` aan, apart van `backend-secret`.

Eén sleutel werkt voor zowel de sandbox (builds vanuit Xcode) als productie
(TestFlight en App Store). De app meldt zelf welke omgeving hij gebruikt.

### Realtime (SSE)

Na elke schrijvende sync, overdracht of vertrek stuurt de backend na de commit
`pg_notify`. Elk backend-proces heeft één `LISTEN`-verbinding en verdeelt de
seintjes over zijn open streams; zonder PostgreSQL gebeurt dat binnen het
proces. In de ingress staan proxy-buffering en de "bad behavior"-codes van
BunkerWeb bijgesteld (`ingress.annotations` in `values.yaml`). Achtergrond
en metingen: `docs/research/sse-realtime-updates.md`.

### Opschalen

Rate limiting en code-limieten gebruiken een cache in het geheugen. Bij meer
dan één replica moet die gedeeld worden (Redis via `CACHES`), en moeten
migraties naar een aparte Job, zodat ze niet dubbel draaien. Realtime werkt
over replicas heen vanzelf (via PostgreSQL `NOTIFY`).
