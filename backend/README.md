# Backend (gepland)

Deze map is gereserveerd voor de Django-backend die spellen synct en spelers
laat uitnodigen. Er staat nog geen code; de besluiten staan in
[ADR-0002](../docs/adr/0002-sync-klaar-datamodel.md) (datamodel) en
[ADR-0003](../docs/adr/0003-django-backend-voor-sync-en-uitnodigingen.md)
(backend).

## Stack

- Python 3.13+, Django 5.x, Django REST Framework
- PostgreSQL
- Docker-image `registry.vels.online/punten/api`, uitgerold met een eigen Helm-chart
  of als extra deployment naast de PWA
- Release-tags: `api-vX.Y.Z`

Voorgestelde indeling als we beginnen:

```
backend/
  pyproject.toml
  manage.py
  puntenteller/        # Django-project (settings, urls, asgi/wsgi)
  accounts/            # Account, Sign in with Apple, tokens
  games/               # Game, Player, ScoreEntry, GameProfile, sync-endpoint
  invites/             # Invite, accepteren
  Dockerfile
```

## Datamodel

Gelijk aan `ios/PuntentellerKit/Sources/PuntentellerKit/Models.swift`. Alle id's
zijn UUID's die de client aanmaakt.

| Model        | Velden |
|--------------|--------|
| `Account`    | `id`, `apple_sub` (uniek), `display_name`, `created_at` |
| `Game`       | `id`, `owner → Account`, `name`, `profile_id?`, `rules` (JSON, zie `GameRules`), `end_turns_left?`, `created_at`, `updated_at`, `finished_at?`, `deleted_at?` |
| `Player`     | `id`, `game → Game`, `name`, `color`, `position`, `account → Account?`, `updated_at` |
| `ScoreEntry` | `id`, `game → Game`, `player → Player`, `delta`, `created_at`, `undone_at?` |
| `GameProfile`| `id`, `owner → Account`, `name`, `rules` (JSON), `updated_at`, `deleted_at?` |
| `Invite`     | `id`, `game → Game`, `player → Player`, `code` (kort, uniek), `created_by → Account`, `expires_at`, `accepted_by → Account?`, `accepted_at?` |

## API-schets (v1)

Authenticatie: `Authorization: Bearer <token>`.

| Methode | Pad | Doel |
|---------|-----|------|
| `POST` | `/api/v1/auth/apple` | Apple identity token → eigen access/refresh-token |
| `DELETE` | `/api/v1/account` | Account en alle data verwijderen (App Store-eis) |
| `POST` | `/api/v1/sync` | Wijzigingen pushen en ophalen (zie hieronder) |
| `POST` | `/api/v1/games/{id}/invites` | Uitnodiging maken voor een `Player` → `{ code, url }` |
| `GET`  | `/api/v1/invites/{code}` | Uitnodiging bekijken (spelnaam, spelernaam, eigenaar) |
| `POST` | `/api/v1/invites/{code}/accept` | Account koppelen aan de speler; het spel wordt zichtbaar |

### Sync-protocol

Eén endpoint, op basis van een cursor en last-writer-wins op recordniveau:

```jsonc
// request
{
  "cursor": "2026-10-16T12:00:00.000Z",   // null bij de eerste sync
  "changes": {
    "games":        [ /* volledige Game-records met updatedAt */ ],
    "players":      [ ... ],
    "scoreEntries": [ /* nieuwe boekingen, of boekingen met undoneAt */ ],
    "gameProfiles": [ ... ]
  }
}
// response
{
  "cursor": "2026-10-16T12:00:05.123Z",
  "changes": { /* alles wat de server sinds `cursor` heeft en zichtbaar is voor dit account */ }
}
```

Regels:

- Een record met een nieuwere `updatedAt` overschrijft het oude. Een
  `ScoreEntry` verandert nooit, behalve dat `undoneAt` gezet kan worden.
- Alleen de eigenaar mag `Game`, `Player` en `ScoreEntry` van een spel wijzigen.
  Gekoppelde spelers krijgen die records alleen in de response.
- Een tombstone (`deletedAt` of `undoneAt`) blijft bewaard, zodat andere
  toestellen de verwijdering ook verwerken.

## Lokaal draaien (straks)

We breiden `docker-compose.yaml` dan uit met een `api`- en een `db`-service
(PostgreSQL).
