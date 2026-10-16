# Puntenteller voor iOS

Native SwiftUI-app voor de App Store. Een port van de PWA in `../frontend`
(ADR-0001).

## Opbouw

```
ios/
  Puntenteller.xcodeproj   # app-project (mappen worden automatisch gesynchroniseerd)
  Puntenteller/            # SwiftUI-app: schermen, thema, assets
  PuntentellerKit/         # Swift-package: domeinmodel + spelregels (geen UI)
```

- **PuntentellerKit** bevat alles wat zonder UI te testen is: `Models.swift`
  (sync-klaar datamodel, ADR-0002), `GameEngine.swift` (boeken, undo, einde van
  het spel, ranglijst, statistiek) en `Coding.swift` (JSON-formaat).
- **Puntenteller** (app) bevat alleen presentatie en state. Nieuwe bestanden in
  `Puntenteller/` worden vanzelf meegenomen; je hoeft `project.pbxproj` niet aan
  te passen.

## Eisen

- Xcode 26 of nieuwer, Swift 6
- Minimaal iOS 17, alleen iPhone, staand
- Bundle-id: `online.vels.puntenteller`

## Bouwen en testen

```sh
open Puntenteller.xcodeproj                 # ⌘R draait de app, ⌘U de tests van de Kit

cd PuntentellerKit && swift test            # snel, zonder simulator
```

Signing staat op automatisch met team `W38CK4LB5F`; aanpassen kan bij
*Signing & Capabilities*.

## App-icoon

Het icoon komt uit `frontend/public/pwa-icon.svg`, zodat web en iOS hetzelfde
icoon hebben. Na een wijziging aan dat SVG-bestand genereer je het opnieuw:

```sh
swift ios/scripts/generate-app-icon.swift   # vanuit de repo-root
```

Het script maakt een vierkante PNG van 1024×1024 zonder transparantie (eis van
de App Store; iOS rondt de hoeken zelf af). Xcode maakt de andere formaten.

## Releasen

1. Verhoog `MARKETING_VERSION` (en `CURRENT_PROJECT_VERSION`) in het project.
2. *Product → Archive* → uploaden naar App Store Connect, of via Xcode Cloud.
3. Tag de commit als `ios-vX.Y.Z`.

Zie `../docs/ios-port.md` voor wat er nog geport moet worden.
