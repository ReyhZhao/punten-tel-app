# App Store: teksten, antwoorden en checklist

Alles wat je in **App Store Connect** invult voor Puntenteller (iOS), op één
plek. De teksten zijn op lengte gecontroleerd tegen Apple's limieten.

## Checklist

**Al geregeld in de repo:**

- [x] App-icoon (1024×1024, zonder transparantie): `ios/scripts/generate-app-icon.swift`
- [x] Export compliance: `ITSAppUsesNonExemptEncryption = NO` (alleen standaard-HTTPS)
- [x] Privacy-manifest: `ios/Puntenteller/PrivacyInfo.xcprivacy`
- [x] Account verwijderen in de app (verplicht bij accounts): *Instellingen → Account → Account verwijderen*
- [x] Privacybeleid: <https://punten.vels.online/privacy>
- [x] Supportpagina: <https://punten.vels.online/support>
- [x] Screenshots 6,9" (1320×2868) en 6,3" (1206×2622): `ios/AppStore/screenshots/`
- [x] Review-account in de backend (vaste code, geen e-mail; zie hieronder)

**Nog door jou te doen:**

- [x] **PWA uitrollen:** `/privacy` en `/support` staan live (gecontroleerd 6 nov 2026).
- [x] **Pushmeldingen:** `api.push.keyId` staat in `deployment/values.yaml`.
- [ ] **Review-account testen:** `api.review.email` staat op `apple@vels.online`.
      Controleer vóór het indienen dat `REVIEW_ACCOUNT_CODE` in Vault staat
      en dat inloggen met die code werkt in een TestFlight-build:
      `vault kv patch kv/puntenteller REVIEW_ACCOUNT_CODE=<6 cijfers>`
- [ ] **Buildnummer:** `CURRENT_PROJECT_VERSION` staat nog op `1`. Laat Xcode
      dit bij *Distribute* ophogen ("Manage Version and Build Number"), of hoog
      het zelf op tot boven de laatste TestFlight-build.
- [ ] **In App Store Connect:** de onderstaande teksten, het privacylabel en de
      leeftijdsclassificatie invullen. Prijs: gratis.
- [ ] **Indienen:** een build uploaden (Xcode → *Product → Archive* →
      *Distribute*) en die bij de versie kiezen.
- [ ] **Juridische gegevens nakijken:** de verantwoordelijke en het
      contactadres in het privacybeleid (`frontend/public/privacy.html`).

## App-informatie

| Veld | Waarde |
|------|--------|
| Naam | **Puntenteller** |
| Ondertitel (NL) | Scores bijhouden bij spellen |
| Subtitle (EN) | Score keeper for board games |
| Bundle-ID | `online.vels.puntenteller` |
| SKU | `puntenteller-ios` (vrij te kiezen) |
| Primaire categorie | **Hulpprogramma's** (Utilities) |
| Secundaire categorie | Amusement (Entertainment) |
| Privacybeleid-URL | <https://punten.vels.online/privacy> |
| Support-URL | <https://punten.vels.online/support> |
| Marketing-URL | <https://punten.vels.online> (optioneel) |
| Copyright | 2026 Eddie Vels |
| Prijs | Gratis |

Waarom niet de categorie *Spellen*: Puntenteller is zelf geen spel, maar een
hulpmiddel bij spellen. Reviewers zetten zulke apps soms in een andere
categorie, of wijzen ze af als ze onder *Spellen* staan.

## Teksten

### Promotietekst

**NL:** Tel punten bij elk bordspel en kaartspel. Deel een spel met je
medespelers en zie de stand realtime op ieders telefoon.

**EN:** Keep score for any board or card game. Share a game with your fellow
players and watch the standings update live on every phone.

### Beschrijving (NL)

```
Puntenteller houdt de stand bij, zodat jij kunt spelen.

Voor elk bordspel en kaartspel: klaverjassen, Yahtzee, Rummikub, Duizendbommen of je eigen huisregels. Maak een spel aan, voeg spelers toe en tel met één tik punten op of af.

SPELEN
• Hoogste of laagste score wint
• Maximale score, met de keuze tussen direct stoppen, de ronde afmaken of iedereen nog één beurt
• Maximaal aantal rondes
• Timer per beurt
• Historie met ongedaan maken per boeking
• Winnaarsscherm met podium en confetti

SPELPROFIELEN
Bewaar je favoriete spelregels als profiel en start de volgende keer in een paar tikken. Bekijk per speltype wie de meeste overwinningen heeft. Kies wie jij bent, dan sta je automatisch in elk nieuw spel.

SAMEN SPELEN (optioneel)
Met een gratis account nodig je medespelers uit met hun uitnodigcode, een QR-code of hun e-mailadres. Zij zien het spel en de stand realtime op hun eigen telefoon, en als je dat wilt, houden ze zelf ook de scores bij. Je krijgt een melding als je wordt uitgenodigd of als een spel is afgelopen. Een wachtwoord is niet nodig: je logt in met een code per e-mail.

PRIVACY
Zonder account blijft alles op je toestel. Geen advertenties, geen tracking.
```

### Description (EN)

```
Puntenteller keeps score, so you can keep playing.

For any board or card game: Yahtzee, Rummikub, Klaverjassen or your own house rules. Create a game, add players and add or subtract points with a single tap.

PLAY
• Highest or lowest score wins
• Maximum score: stop immediately, finish the round, or give everyone one more turn
• Maximum number of rounds
• Turn timer
• History with undo for every entry
• Winner screen with podium and confetti

GAME PROFILES
Save your favourite rules as a profile and start your next game in a few taps. See who has the most wins per game type. Pick which player is you and you're added to every new game automatically.

PLAY TOGETHER (optional)
With a free account you invite fellow players with their invite code, a QR code or their email address. They see the game and the standings live on their own phone, and if you allow it they can keep score too. You get a notification when you're invited or when a game ends. No password needed: sign in with a code sent by email.

PRIVACY
Without an account everything stays on your device. No ads, no tracking.
```

### Trefwoorden

- **NL:** `scorebord,punten,score,bordspel,kaartspel,klaverjassen,yahtzee,rummikub,duizendbommen,spelavond`
- **EN:** `scoreboard,score keeper,points,board game,card game,yahtzee,rummikub,game night,tally,counter`

### Nieuw in deze versie (1.0.0)

**NL:** Eerste versie van Puntenteller voor iPhone.
**EN:** First release of Puntenteller for iPhone.

## Privacylabel ("App-privacy")

Komt overeen met `PrivacyInfo.xcprivacy` en het privacybeleid.

- **Verzamelt de app gegevens?** Ja. Alleen bij gebruik van het optionele
  account.
- **Gegevens die aan de gebruiker gekoppeld zijn:**

  | Type (App Store Connect) | Wat | Doel | Tracking |
  |--------------------------|-----|------|----------|
  | Contactgegevens → **E-mailadres** | inloggen, uitgenodigd worden | Functionaliteit van de app | Nee |
  | Contactgegevens → **Naam** | schermnaam die medespelers zien | Functionaliteit van de app | Nee |
  | Gebruikersinhoud → **Overige gebruikersinhoud** | spellen, spelersnamen, scores, profielen | Functionaliteit van de app | Nee |

- **Tracking:** nee.
- **Niet verzameld:** locatie, contacten, aankopen, gebruiksgegevens,
  diagnosegegevens en identificatoren voor advertenties.

## Leeftijdsclassificatie

Beantwoord alle vragen met **Geen** of **Nee**: geen geweld, geen gokken, geen
onbeperkte toegang tot internet, en geen chat. Spelers zien alleen elkaars
schermnaam en de spelgegevens. Resultaat: **4+**.

## Informatie voor de review

**Inloggegevens (demo-account):**

- E-mail: `apple@vels.online` (`api.review.email`)
- Code: de waarde van `REVIEW_ACCOUNT_CODE` in Vault

**Notities voor de reviewer (Engels):**

```
Puntenteller works fully without an account. An account is optional and only
needed to share games with other players and to sync between devices.

To test the account features, sign in via Settings (gear icon) → Account with
the demo email address above. Instead of a code sent by email, enter the
6-digit demo code above. No password is needed.

Inviting another player: create a new game, add a player and tap the envelope
icon next to that player, or in a running game use ⋯ → "Spelers en delen"
(Players & sharing). A player is found by their 6-digit invite code (shown
under Account → "Toon mijn uitnodigcode", valid for 10 minutes), by scanning
that QR code, or by their exact email address. There is no public search or
directory of users.

Camera: only used to scan a fellow player's invite QR code. No images are
stored or uploaded.

Account deletion: Settings → Account → "Account verwijderen" (Delete account).
Privacy policy: https://punten.vels.online/privacy
```

## Screenshots

`ios/AppStore/screenshots/6.9-inch/` bevat vier screenshots van 1320×2868,
gemaakt op 6 nov 2026 met een Release-build op een iPhone 17 Pro Max-simulator
(iOS-taal NL), voorbeelddata, lichte weergave en een statusbalk op 9:41:

1. `1-spellen.png`: overzicht van spellen, waaronder een gedeeld spel
2. `2-score-tellen.png`: score tellen met timer en de melding "Maximum bereikt"
3. `3-winnaar.png`: winnaar met podium
4. `4-spelers.png`: "Wie ben jij?" en de ranglijst met overwinningen per speltype

`ios/AppStore/screenshots/6.3-inch/` bevat dezelfde vier schermen op 1206×2622
(iPhone 17 Pro-simulator) voor het vak "iPhone 6,1"/6,3"" in App Store Connect.
Dat vak accepteert geen 1320×2868; zet elke set in het juiste vak.

Sinds 2024 is de 6,9"-set genoeg; App Store Connect schaalt die voor kleinere
iPhones. De app is alleen voor iPhone, dus iPad-screenshots zijn niet nodig.
