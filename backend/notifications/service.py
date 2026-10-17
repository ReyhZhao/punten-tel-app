"""
Welke pushmelding naar wie (ADR-0003). Niet bij elke boeking: zolang de app
open is, regelt de realtime-stream dat. Wel bij momenten die ertoe doen als
de app dicht is:

- je bent toegevoegd aan een spel (uitgenodigd);
- een spel waarin je meedoet is afgelopen;
- een spel is aan jou overgedragen.

Meldingen gaan pas na de commit, en in een achtergrond-thread, zodat Apple
een sync nooit vertraagt.
"""

import logging
from concurrent.futures import ThreadPoolExecutor

from django.conf import settings
from django.db import close_old_connections, transaction

from .apns import DEAD_TOKEN_REASONS, get_client
from .models import PushDevice

log = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="push")


def _payload(game, kind: str, body: str) -> dict:
    return {
        "aps": {
            "alert": {"title": game.name, "body": body},
            "sound": "default",
            "thread-id": str(game.pk),  # meldingen per spel gegroepeerd
        },
        "gameId": str(game.pk),
        "kind": kind,
    }


def _send(user_ids, payload: dict, collapse_id: str) -> None:
    users = {str(u) for u in user_ids}
    if not users or get_client() is None:
        return

    def deliver():
        try:
            client = get_client()
            dead = []
            for device_id, token, environment in PushDevice.objects.filter(user_id__in=users).values_list(
                "id", "token", "environment"
            ):
                if client.send(token, environment, payload, collapse_id=collapse_id) in DEAD_TOKEN_REASONS:
                    dead.append(device_id)
            if dead:
                PushDevice.objects.filter(id__in=dead).delete()
        except Exception:
            log.exception("Pushmelding versturen mislukt")

    def deliver_in_thread():
        # Alleen in de eigen thread de verbinding opruimen; op de request-thread
        # (PUSH_ASYNC uit, zoals in tests) zou dat de lopende verbinding sluiten.
        try:
            deliver()
        finally:
            close_old_connections()

    def schedule():
        if settings.PUSH_ASYNC:
            _executor.submit(deliver_in_thread)
        else:
            deliver()

    transaction.on_commit(schedule)


def invited(game, account_ids, actor) -> None:
    _send(
        set(account_ids) - {actor.pk},
        _payload(game, "invited", f"{actor.display_name} heeft je toegevoegd aan dit spel."),
        collapse_id=f"invited-{game.pk}",
    )


def transferred(game, new_owner_id, actor) -> None:
    _send(
        {new_owner_id},
        _payload(game, "transferred", f"{actor.display_name} heeft dit spel aan jou overgedragen."),
        collapse_id=f"transferred-{game.pk}",
    )


def finished(game, account_ids, actor) -> None:
    winner = _winner(game)
    body = (
        f"Afgelopen — {winner[0]} wint met {winner[1]} punten."
        if winner else "Het spel is afgelopen."
    )
    _send(set(account_ids) - {actor.pk}, _payload(game, "finished", body), collapse_id=f"finished-{game.pk}")


def _winner(game) -> tuple[str, int] | None:
    """Naam en stand van de winnaar volgens de spelregels; gelijk = eerste in volgorde."""
    from games.models import ScoreEntry

    totals: dict = {}
    for player_id, delta in ScoreEntry.objects.filter(game=game, undone_at__isnull=True).values_list(
        "player_id", "delta"
    ):
        totals[player_id] = totals.get(player_id, 0) + delta
    if not totals:
        return None
    players = list(game.players.order_by("position"))
    low = game.rules.get("scoring") == "low"
    best = min if low else max
    top = best(totals.get(p.pk, 0) for p in players)
    winner = next(p for p in players if totals.get(p.pk, 0) == top)
    return winner.name, top
