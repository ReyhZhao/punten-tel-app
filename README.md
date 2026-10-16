# Puntenteller

Een app om punten bij te houden tijdens bordspellen: spellen aanmaken, spelers
toevoegen, punten op- en aftellen, historie met undo, timer per beurt en een
winnaar-scherm met podium.

Deze repo bevat meerdere apps naast elkaar (zie
[ADR-0001](docs/adr/0001-pwa-en-ios-naast-elkaar.md)):

| Map          | Wat                                              | Status                     |
|--------------|--------------------------------------------------|----------------------------|
| `frontend/`  | PWA (Vite + React + TypeScript), draait in Docker/Helm | In productie (v1.x)  |
| `ios/`       | Native iOS-app (SwiftUI) voor de App Store        | In opbouw — port van de PWA |
| `backend/`   | Django-API voor sync van scores en uitnodigen van spelers | Gepland — alleen ontwerp |
| `prototype/` | Oorspronkelijk HTML/React-designprototype         | Referentie                 |
| `deployment/`| Helm-chart voor de PWA                            | In productie               |
| `docs/`      | Design-handoff, ADR's, port-plan                  |                            |

## Documentatie

- [`CONTEXT.md`](CONTEXT.md) — domeintaal (begrippenlijst) die web, iOS en backend delen.
- [`docs/design-handoff.md`](docs/design-handoff.md) — design tokens, schermen en interacties (Confetti-thema).
- [`docs/ios-port.md`](docs/ios-port.md) — plan en feature-checklist voor de iOS-port.
- [`docs/adr/`](docs/adr/) — architectuurbeslissingen.
- [`backend/README.md`](backend/README.md) — ontwerp van de toekomstige sync-backend.

## Ontwikkelen

**PWA**

```sh
cd frontend
npm ci
npm run dev        # lokale dev-server
npm run build      # bouwt naar frontend/dist (wordt meegecommit)
```

**iOS**

```sh
open ios/Puntenteller.xcodeproj            # app in Xcode
cd ios/PuntentellerKit && swift test       # domeinlogica-tests, zonder simulator
```

Zie [`ios/README.md`](ios/README.md) voor details.

## Releases

- **PWA:** tag `vX.Y.Z` → GitHub Actions bouwt de Docker-image en zet de tag in `deployment/values.yaml`.
- **iOS:** tag `ios-vX.Y.Z` (matcht bewust níet met `v*.*.*`, zodat de PWA-release niet afgaat).
  Distributie via TestFlight / App Store Connect.
