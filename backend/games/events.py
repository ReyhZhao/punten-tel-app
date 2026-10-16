"""
Realtime-seintjes via Server-Sent Events (docs/research/sse-realtime-updates.md).

`GET /api/v1/events` houdt een stream open en stuurt `event: change` met de
nieuwe cursor zodra er iets verandert in een spel waar je toegang toe hebt
(of toe had). De client synct dan via de gewone `POST /sync`; via SSE gaan
dus nooit gegevens.

Verdeling over processen gaat via PostgreSQL `LISTEN/NOTIFY`: elk proces heeft
één gedeelde LISTEN-verbinding (een verbinding per stream zou de database
uitputten). Zonder PostgreSQL (lokaal met SQLite, tests) gaat het binnen het
proces.
"""

import asyncio
import json
import logging

from asgiref.sync import sync_to_async
from django.conf import settings
from django.db import connection
from django.http import HttpResponse, StreamingHttpResponse

from accounts.authentication import BearerTokenAuthentication

log = logging.getLogger(__name__)

CHANNEL = "puntenteller_events"
KEEPALIVE_SECONDS = 20  # ruim binnen de read-timeout van de proxy (60 s)


def _uses_postgres() -> bool:
    return settings.DATABASES["default"]["ENGINE"].endswith("postgresql")


class Broker:
    """Verdeelt seintjes over de open streams in dit proces."""

    def __init__(self) -> None:
        self.queues: dict[str, set[asyncio.Queue]] = {}
        self.loop: asyncio.AbstractEventLoop | None = None
        self.listener: asyncio.Task | None = None

    def subscribe(self, user_id: str) -> asyncio.Queue:
        self.loop = asyncio.get_running_loop()
        if _uses_postgres() and (self.listener is None or self.listener.done()):
            self.listener = self.loop.create_task(self._listen())
        queue: asyncio.Queue = asyncio.Queue(maxsize=10)
        self.queues.setdefault(user_id, set()).add(queue)
        return queue

    def unsubscribe(self, user_id: str, queue: asyncio.Queue) -> None:
        queues = self.queues.get(user_id)
        if queues is not None:
            queues.discard(queue)
            if not queues:
                del self.queues[user_id]

    def dispatch(self, user_ids, cursor: int) -> None:
        for user_id in user_ids:
            for queue in list(self.queues.get(user_id, ())):
                if queue.full():
                    continue  # client is al achter; één seintje is genoeg
                queue.put_nowait(cursor)

    async def _listen(self) -> None:
        import psycopg

        db = settings.DATABASES["default"]
        while True:
            try:
                conn = await psycopg.AsyncConnection.connect(
                    host=db["HOST"], port=db["PORT"], dbname=db["NAME"],
                    user=db["USER"], password=db["PASSWORD"], autocommit=True,
                )
                async with conn:
                    await conn.execute(f"LISTEN {CHANNEL}")
                    async for note in conn.notifies():
                        msg = json.loads(note.payload)
                        self.dispatch(msg["users"], msg["cursor"])
            except asyncio.CancelledError:
                raise
            except Exception:
                # Verbinding weg (bv. database-failover): na korte pauze opnieuw.
                log.exception("LISTEN-verbinding verbroken; opnieuw verbinden")
                await asyncio.sleep(2)


broker = Broker()


def notify(user_ids, cursor: int) -> None:
    """Seintje aan deze accounts. Aanroepen ná de commit (transaction.on_commit)."""
    users = sorted({str(u) for u in user_ids})
    if not users:
        return
    if _uses_postgres():
        with connection.cursor() as c:
            c.execute("SELECT pg_notify(%s, %s)", [CHANNEL, json.dumps({"users": users, "cursor": cursor})])
    elif broker.loop is not None and not broker.loop.is_closed():
        broker.loop.call_soon_threadsafe(broker.dispatch, users, cursor)


async def events(request):
    if request.method != "GET":
        return HttpResponse(status=405)

    def authenticate():
        try:
            return BearerTokenAuthentication().authenticate(request)
        except Exception:
            return None
        finally:
            # Django sluit verbindingen pas aan het eind van het verzoek; bij een
            # stream is dat als de client weggaat. Daarom hier zelf sluiten,
            # anders houdt elke open stream een databaseverbinding vast.
            connection.close()

    result = await sync_to_async(authenticate)()
    if not result:
        return HttpResponse('{"code": "unauthorized"}', status=401, content_type="application/json")
    user_id = str(result[0].pk)
    queue = broker.subscribe(user_id)

    async def stream():
        try:
            yield "retry: 5000\n\n"
            while True:
                try:
                    cursor = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_SECONDS)
                    yield f"event: change\ndata: {cursor}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            broker.unsubscribe(user_id, queue)

    response = StreamingHttpResponse(stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"  # nginx/BunkerWeb: niet bufferen
    return response
