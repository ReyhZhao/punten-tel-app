"""
Cijfers voor het beheerdersdashboard (/admin/statistieken/).

Alleen tellingen: geen e-mailadressen, namen of spelinhoud, zodat de pagina
geen persoonsgegevens laat zien. "Actief" leiden we af uit
`AuthToken.last_used_at`, dat de API hooguit één keer per uur bijwerkt; een
account dat al zijn toestellen heeft uitgelogd telt dus niet meer als actief.
"""

from dataclasses import dataclass
from datetime import timedelta

from django.db.models import Count, F, Q
from django.db.models.functions import TruncWeek
from django.utils import timezone

from accounts.models import AuthToken, User
from games.models import Game, GameProfile, Player, ScoreEntry
from notifications.models import PushDevice

WEEKS = 12


@dataclass
class Week:
    start: object  # date
    value: int
    pct: int  # balkhoogte, 0-100, ten opzichte van de hoogste week


def _weekly(qs, field: str, since) -> list[Week]:
    """Aantal per week (maandag als begin) over de laatste WEEKS weken, lege weken als 0."""
    rows = (
        qs.filter(**{f"{field}__gte": since})
        .annotate(week=TruncWeek(field))
        .values("week")
        .annotate(n=Count("pk"))
    )
    counts = {r["week"].date() if hasattr(r["week"], "date") else r["week"]: r["n"] for r in rows}
    first = timezone.localdate(since) - timedelta(days=timezone.localdate(since).weekday())
    weeks = [first + timedelta(weeks=i) for i in range(WEEKS + 1)]
    values = [counts.get(w, 0) for w in weeks]
    top = max(values) or 1
    return [Week(w, v, round(100 * v / top)) for w, v in zip(weeks, values)]


def _active_accounts(since) -> int:
    return AuthToken.objects.filter(last_used_at__gte=since).values("user").distinct().count()


def collect(now=None) -> dict:
    now = now or timezone.now()
    d7, d30 = now - timedelta(days=7), now - timedelta(days=30)
    since = now - timedelta(weeks=WEEKS)

    users = User.objects.filter(is_staff=False, is_superuser=False)
    accounts = users.aggregate(
        total=Count("pk"),
        verified=Count("pk", filter=Q(is_verified=True)),
        inactive=Count("pk", filter=Q(is_active=False)),
        new_7d=Count("pk", filter=Q(date_joined__gte=d7)),
        new_30d=Count("pk", filter=Q(date_joined__gte=d30)),
    )
    accounts["active_1d"] = _active_accounts(now - timedelta(days=1))
    accounts["active_7d"] = _active_accounts(d7)
    accounts["active_30d"] = _active_accounts(d30)
    accounts["admins"] = User.objects.filter(Q(is_staff=True) | Q(is_superuser=True)).count()

    devices = {
        "tokens": AuthToken.objects.count(),
        "push_production": PushDevice.objects.filter(environment=PushDevice.Environment.PRODUCTION).count(),
        "push_sandbox": PushDevice.objects.filter(environment=PushDevice.Environment.SANDBOX).count(),
    }

    live = Game.objects.filter(deleted_at__isnull=True)
    # Gedeeld: minstens één speler is gekoppeld aan een ander account dan de eigenaar.
    shared_ids = (
        Player.objects.filter(account__isnull=False, game__deleted_at__isnull=True)
        .exclude(account_id=F("game__owner_id"))
        .values("game_id")
        .distinct()
    )
    games = live.aggregate(
        total=Count("pk"),
        finished=Count("pk", filter=Q(finished_at__isnull=False)),
        active_7d=Count("pk", filter=Q(updated_at__gte=d7)),
        new_7d=Count("pk", filter=Q(created_at__gte=d7)),
        new_30d=Count("pk", filter=Q(created_at__gte=d30)),
    )
    games["in_progress"] = games["total"] - games["finished"]
    games["shared"] = shared_ids.count()
    games["deleted"] = Game.objects.filter(deleted_at__isnull=False).count()
    games["owners"] = live.values("owner").distinct().count()
    games["profiles"] = GameProfile.objects.filter(deleted_at__isnull=True).count()

    players = Player.objects.filter(game__deleted_at__isnull=True)
    seats = {
        "total": players.count(),
        "linked": players.filter(account__isnull=False).count(),
        "accounts_in_games": players.filter(account__isnull=False).values("account").distinct().count(),
    }
    seats["avg_per_game"] = round(seats["total"] / games["total"], 1) if games["total"] else 0

    # Verdeling van het aantal spelers per spel: 1, 2, 3, ..., 8+.
    sizes = live.annotate(n=Count("players")).values_list("n", flat=True)
    buckets = {label: 0 for label in ["1", "2", "3", "4", "5", "6", "7", "8+"]}
    for n in sizes:
        if n:
            buckets["8+" if n >= 8 else str(n)] += 1
    top = max(buckets.values()) or 1
    size_dist = [{"label": k, "value": v, "pct": round(100 * v / top)} for k, v in buckets.items()]

    entries = ScoreEntry.objects.filter(undone_at__isnull=True, game__deleted_at__isnull=True)
    scoring = {
        "total": entries.count(),
        "last_7d": entries.filter(created_at__gte=d7).count(),
        "undone": ScoreEntry.objects.filter(undone_at__isnull=False).count(),
    }

    return {
        "generated_at": now,
        "accounts": accounts,
        "devices": devices,
        "games": games,
        "seats": seats,
        "scoring": scoring,
        "size_dist": size_dist,
        "weekly": [
            ("Nieuwe accounts", _weekly(users, "date_joined", since)),
            ("Nieuwe spellen", _weekly(Game.objects.all(), "created_at", since)),
            ("Boekingen", _weekly(ScoreEntry.objects.filter(undone_at__isnull=True), "created_at", since)),
        ],
    }

