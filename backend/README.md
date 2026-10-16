# Backend

Django-API voor het delen van spellen en spelprofielen tussen toestellen en
spelers. Besluiten: [ADR-0002](../docs/adr/0002-sync-klaar-datamodel.md)
(datamodel) en [ADR-0003](../docs/adr/0003-django-backend-voor-sync-en-uitnodigingen.md)
(backend).

- Python 3.13, Django 5.2 LTS, Django REST Framework, PostgreSQL 17
- Draait op hetzelfde domein als de PWA: `https://punten.vels.online/api/…`
- Image `registry.vels.online/punten/api`, release-tags `api-vX.Y.Z`

```
backend/
  puntenteller/   # instellingen, urls, health-check
  accounts/       # account, inlogcodes, tokens, /me
  games/          # Game, Player, ScoreEntry, GameProfile, sync, uitnodigen
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

Codes zijn 15 minuten geldig, met maximaal 5 pogingen per code en 5 codes per
e-mailadres per uur. Daarnaast geldt een limiet per IP-adres.

### Uitnodigen

| Methode | Pad | Doel |
|---------|-----|------|
| `POST` | `/api/v1/accounts/lookup` | `{email}` → `{id, displayName}`, alleen bij een exacte match met een bevestigd account. De app bewaart `id` als `SavedPlayer.accountId` |
| `POST` | `/api/v1/games/{id}/leave` | Jezelf uit een gedeeld spel halen |

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

**Eenmalig vóór de eerste uitrol:** maak de Secret voor de app aan. Die staat
niet in git.

```sh
kubectl create secret generic punten-api \
  --from-literal=DJANGO_SECRET_KEY="$(openssl rand -base64 48)" \
  --from-literal=EMAIL_HOST_PASSWORD='<smtp-wachtwoord>'
```

Vul ook `api.email.host` en `api.email.user` in `values.yaml` in.

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
| `THROTTLE_AUTH`, `THROTTLE_LOOKUP` | `20/hour`, `30/hour` | per IP resp. per gebruiker |

### Opschalen

Rate limiting en code-limieten gebruiken een cache in het geheugen. Bij meer
dan één replica moet die gedeeld worden (Redis via `CACHES`), en moeten
migraties naar een aparte Job, zodat ze niet dubbel draaien.
