# Onderzoek: realtime score-updates met Server-Sent Events (SSE)

- **Datum:** 2026-10-16
- **Status:** gebouwd volgens dit ontwerp (`backend/games/events.py`,
  `SyncEngine.swift`, `frontend/src/useSync.ts`). Gemeten van begin tot eind,
  met een boeking door een medespeler tot de nieuwe stand in de andere app:
  PWA 0,6–1,3 s, iOS 0,4–1,6 s. Daarin zit de bewuste willekeurige
  vertraging van 0,2–1,5 s. In de container met 2 uvicorn-workers kwamen 60
  van de 60 seintjes aan.
- **Vraag:** Kunnen we SSE gebruiken, zodat medespelers een boeking direct
  zien in plaats van na de volgende poll (nu elke 20 seconden)?
- **Conclusie:** **Ja.** SSE past goed als *seintje*: de server meldt alleen
  dat er iets veranderd is, en de client haalt het op via de bestaande
  `POST /api/v1/sync`. Een proef tegen onze echte backend met PostgreSQL
  bevestigt dat. Er zijn drie randvoorwaarden: de backend moet onder ASGI
  draaien, PostgreSQL `LISTEN/NOTIFY` doet de verdeling, en BunkerWeb moet
  bijgesteld worden.

## Aanbevolen ontwerp

```
 Toestel A                Backend (ASGI)                         Toestel B
 ─────────                ──────────────                         ─────────
 POST /sync ──────────▶  sync() schrijft; na commit:
                         pg_notify('puntenteller_events',
                           {users:[A,B], cursor:1241})
                                │
                         ┌──────┴───────── PostgreSQL ─────────┐
                         ▼                                      │
                  1 LISTEN-verbinding per proces                │
                  → queue per open stream van B                 │
                                │                               │
                                └── event: change ─────────────▶│  GET /api/v1/events (open stream)
                                    data: 1241                  │  → POST /sync (bestaande code)
```

1. **Endpoint `GET /api/v1/events`** (async view, `text/event-stream`). Het
   stuurt `event: change` met de nieuwe cursor als data, en elke 20 seconden
   een commentaarregel als keep-alive.
2. **Na elke schrijvende sync:** `pg_notify` met de accounts die toegang
   hebben tot de gewijzigde spellen (eigenaar plus gekoppelde spelers), via
   `transaction.on_commit`. Ook `transfer` en `leave` sturen een seintje.
3. **Eén gedeelde `LISTEN`-verbinding per backend-proces.** Die verdeelt de
   meldingen over `asyncio.Queue`'s per open stream. Een databaseverbinding
   per stream zou CNPG (standaard `max_connections` 100) snel uitputten.
4. **Clients:** krijg je een `change` met een cursor die hoger is dan je eigen
   cursor, dan sync je. Wijzigingen gaan dus nooit via SSE zelf. De sync blijft
   de enige bron van waarheid, en een gemist event kost hooguit een iets
   latere update.
5. **Polling blijft als vangnet**, maar langzamer: elke 60 s in plaats van 20 s
   zolang de stream open is. Bij een verbroken stream terugvallen naar 20 s en
   opnieuw verbinden met backoff.

Waarom geen WebSockets? We hebben alleen server → client nodig. SSE is gewoon
HTTP: het werkt via dezelfde ingress, met dezelfde Bearer-token, zonder
upgrade, en je kunt het met curl testen.

## Proef (spike)

De proef stond in de scratchpad, niet in de repo: een kopie van `backend/` met
een async view, een broker met één `LISTEN`-verbinding, en `pg_notify` in de
sync. Gedraaid onder uvicorn 0.37, met Django 5.2.18 en PostgreSQL 17.

| Meting | Uitkomst |
|--------|----------|
| Seintje bij toestel B na een boeking door A (20 metingen) | mediaan **40 ms** inclusief het sync-verzoek van A; het event komt vrijwel tegelijk met het sync-antwoord bij A binnen |
| 200 gelijktijdige streams in één proces | +26 MB geheugen (~130 KB per stream); **1** `LISTEN`-verbinding; aantal PostgreSQL-verbindingen onveranderd |
| Seintje naar alle 200 streams | binnen **31 ms** |
| 50 streams abrupt verbroken (zoals een app die gesloten wordt) | alle queues binnen 0,5 s opgeruimd; geen lekken |

**Valkuil die de proef aan het licht bracht:** Django sluit een
databaseverbinding pas aan het eind van een verzoek. Bij een stream is dat pas
als de client weggaat. In de eerste versie bleef daardoor per open stream een
PostgreSQL-verbinding openstaan. Bij 200 streams liep PostgreSQL vol
(*"too many clients"*), en daarna faalden ook gewone syncs. Oplossing: in de
stream-view de verbinding direct na het inloggen zelf sluiten
(`connection.close()`). Daarna bleef het aantal verbindingen gelijk.

## Wat er moet veranderen

### Backend

- **ASGI in plaats van WSGI.** Nu draaien er 3 synchrone Gunicorn-workers; een
  open stream zou zo'n worker volledig bezetten. Draai daarom met
  `gunicorn -k uvicorn.workers.UvicornWorker`, of direct met `uvicorn`.
  `puntenteller/asgi.py` toevoegen. De bestaande (synchrone) DRF-views blijven
  gewoon werken; Django voert ze onder ASGI in een threadpool uit.
- **`CONN_MAX_AGE` onder ASGI.** Elke thread in de threadpool houdt een eigen
  verbinding open. Zet `CONN_MAX_AGE` op 0, of gebruik de connection pool van
  psycopg (`OPTIONS: {"pool": True}`, sinds Django 5.1).
- **Meerdere replicas** werken vanzelf, omdat `NOTIFY` via PostgreSQL naar
  elk proces gaat. Elk proces opent één eigen `LISTEN`-verbinding.
- **Nieuw:** `games/events.py` (view en broker), `pg_notify` in `sync()`,
  `transfer()` en `leave()`, plus tests. Tests voor streams vragen om async
  tests (`AsyncClient`) en een echte PostgreSQL; in CI hebben we die al.

### BunkerWeb (ingress)

Uit de documentatie van BunkerWeb:

| Instelling | Standaard | Wat te doen |
|------------|-----------|-------------|
| `REVERSE_PROXY_BUFFERING` | `yes` | De backend stuurt `X-Accel-Buffering: no` mee. BunkerWeb is nginx, dat die header normaal respecteert. **In het cluster nagaan**; anders per pad uitzetten |
| `REVERSE_PROXY_READ_TIMEOUT` | `60s` | Keep-alive elke 20 s houdt de stream open; geen aanpassing nodig |
| `LIMIT_CONN_MAX_HTTP1` / `HTTP2` | 10 / 100 per IP | Met HTTP/2 (iOS en browsers via TLS) ruim voldoende. Over HTTP/1.1 delen spelers achter één wifi-IP er 10 |
| `LIMIT_REQ_RATE` | `2r/s` per IP | Na een event syncen alle toestellen tegelijk. Met meerdere toestellen achter één IP is dat een kleine piek; overweeg een ruimere limiet voor `/api/` |
| `USE_BAD_BEHAVIOR` | tellen 400/401/403/404/429 | **Raakt de huidige API al.** Een verkeerde code (400), een onbekend e-mailadres bij aanmelden of opzoeken (404) of een verlopen token (401) tellen als "slecht gedrag" en kunnen een IP tijdelijk blokkeren. Los van SSE aan te raden: deze codes voor `/api/` uitzonderen of de drempel verhogen |

Instellen gaat met annotaties op de ingress: `bunkerweb.io/<INSTELLING>`, of
per host `bunkerweb.io/punten.vels.online_<INSTELLING>`.

### iOS

- **Stream openen:** `URLSession.bytes(for:)` met de Bearer-header, en dan
  regel voor regel lezen via `.lines`. Er is geen extra bibliotheek nodig.
- **Wanneer:** alleen op de voorgrond; `SyncEngine.setActive` beheert dat al.
  iOS breekt de verbinding in de achtergrond af. Voor meldingen buiten de app
  blijft push (APNs) nodig; dat staat al als open punt.

### PWA

- **`EventSource`** (de browser-API voor SSE) kan **geen** `Authorization`-header
  meesturen. De opties zijn:
  1. `fetch` met een `ReadableStream`, en de SSE-regels zelf parsen
     (~40 regels code; de Bearer-token blijft gelijk). **Aanbevolen.**
  2. Een kortlevend stream-token in de querystring. Werkt met
     `EventSource`, maar tokens in URL's komen in logs terecht.
- **Service worker:** die vangt alleen navigaties af (`/api` staat op de
  denylist) en cachet `/api` niet, dus de stream werkt erdoorheen.

## Risico's en open punten

- **Mobiel netwerk:** NAT-routers en mobiele netwerken verbreken stille
  verbindingen. De keep-alive van 20 s en automatisch opnieuw verbinden
  vangen dat op. Polling blijft het vangnet.
- **Batterij:** een open TCP-verbinding met af en toe een keep-alive is
  zuiniger dan polling elke 20 s, zeker als we polling naar 60 s verlagen.
- **Beveiliging:** de stream bevat alleen een cursor en geen speldata. Wie het
  token heeft, ziet alleen *dat* er iets veranderd is.
- **Te verifiëren in het cluster:** of BunkerWeb `X-Accel-Buffering: no`
  respecteert, en of HTTP/2 tot aan de client werkt.

## Inschatting

Ongeveer een dag werk:

- backend: ASGI, events-view, notify en tests;
- clients: SSE-lezer en koppeling aan `syncNow`, in Swift en TypeScript;
- ingress-annotaties, en de proef herhalen in het cluster.

De bestaande sync verandert niet. Valt SSE weg, dan werkt alles zoals nu.

## Bronnen

- BunkerWeb-documentatie, *Features* (reverse proxy, limieten, bad behavior): <https://docs.bunkerweb.io/latest/features/>
- BunkerWeb-documentatie, *Integrations* (Kubernetes-annotaties): <https://docs.bunkerweb.io/latest/integrations/>
- Django-ticket #34752, afhandeling van `http.disconnect` bij streaming responses: <https://code.djangoproject.com/ticket/34752>
- Django-forum, client disconnect bij een async `StreamingHttpResponse`: <https://forum.djangoproject.com/t/how-do-i-detect-a-client-disconnect-from-an-async-streaminghttpresponse/22323>
- uvicorn-discussie #2338, disconnects bij SSE: <https://github.com/encode/uvicorn/discussions/2338>
- SSE achter nginx (buffering en time-outs): <https://oneuptime.com/blog/post/2025-12-16-server-sent-events-nginx/markdown>
