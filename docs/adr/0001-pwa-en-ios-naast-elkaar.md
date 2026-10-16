# ADR-0001: PWA en native iOS-app naast elkaar in één repo

- **Status:** Geaccepteerd
- **Datum:** 2026-10-16

## Context

De Puntenteller draait nu als PWA (`frontend/`), via Docker en Helm uitgerold.
We willen in de Apple App Store, en dat vraagt om een native app. Een Android-app
komt er niet: Android-gebruikers blijven de PWA gebruiken.

## Beslissing

- De PWA blijft in `frontend/` staan en blijft onderhouden en uitgerold. De map
  wordt **niet** hernoemd, omdat CI (`release.yml`), de Dockerfile-context en de
  Helm-chart dat pad gebruiken.
- De native app komt in `ios/` en wordt in **SwiftUI** gebouwd (minimaal iOS 17,
  Swift 6).
- De domeinlogica (spelregels, einde van een spel, ranglijst) staat in een los
  Swift-package, `ios/PuntentellerKit`. Zo is ze zonder simulator te testen met
  `swift test`, en kan ze later ook in een widget, Watch-app of App Clip gebruikt
  worden.
- `CONTEXT.md` is de gedeelde domeintaal. Bij gedragsverschillen tussen web en
  iOS is de PWA de referentie, tenzij een ADR iets anders zegt (zie ADR-0002).
- Release-tags hebben een prefix per app: `vX.Y.Z` voor de PWA (zoals nu),
  `ios-vX.Y.Z` voor iOS.

## Gevolgen

- Een featurewijziging kan in twee codebases nodig zijn. `docs/ios-port.md`
  houdt bij wat al geport is.
- De twee apps delen geen data op een toestel: wie de PWA op een iPhone
  gebruikt, ziet zijn spellen niet vanzelf in de iOS-app. Een export/import-flow
  of sync via de backend (ADR-0003) lost dat op.
