"""
Sync: de client stuurt zijn wijzigingen en de laatst geziene revisie (cursor),
en krijgt alles terug wat sindsdien zichtbaar voor hem veranderd is.

Regels (ADR-0003):
- Bij conflicten wint de nieuwste `updatedAt` (last-writer-wins per record).
- Boekingen worden alleen toegevoegd; daarna kan alleen `undoneAt` nog gezet worden.
- Alleen de eigenaar wijzigt een spel en de spelers ervan (ook uitnodigen =
  een speler aan een account koppelen). Gekoppelde spelers mogen boeken als
  de eigenaar `participantsCanScore` aanzet; ze mogen dan ook de spelstatus
  bijwerken (`endTurnsLeft`, `finishedAt`), want hun boeking kan het spel beëindigen.
- Spelprofielen zijn van hun eigenaar. Deelnemers krijgen het profiel van een
  gedeeld spel mee, alleen-lezen.

Wat niet mag, wordt overgeslagen en teruggemeld in `rejected`, zodat één fout
record de rest niet tegenhoudt.
"""

from dataclasses import dataclass, field

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from . import serializers as wire
from .access import can_score, has_access, record_access, visible_games
from .models import Game, GameAccessEvent, GameProfile, Player, ScoreEntry
from .revisions import RevisionAllocator, current_revision

User = get_user_model()


@dataclass
class Rejection:
    type: str
    id: str
    reason: str


@dataclass
class SyncResult:
    cursor: int
    changes: dict
    removed_game_ids: list[str]
    accounts: list[dict]
    rejected: list[Rejection] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "cursor": self.cursor,
            "changes": self.changes,
            "removedGameIds": self.removed_game_ids,
            "accounts": self.accounts,
            "rejected": [r.__dict__ for r in self.rejected],
        }


def sync(user, cursor: int | None, changes: dict) -> SyncResult:
    cursor = cursor or 0
    with transaction.atomic():
        applier = _Applier(user)
        applier.apply(changes)
        new_cursor = applier.revisions.used or current_revision()
        result = _collect(user, cursor, new_cursor)
        result.rejected = applier.rejected
    return result


class _Applier:
    def __init__(self, user) -> None:
        self.user = user
        self.revisions = RevisionAllocator()
        self.rejected: list[Rejection] = []

    def reject(self, type_: str, id_, reason: str) -> None:
        self.rejected.append(Rejection(type_, str(id_), reason))

    def apply(self, changes: dict) -> None:
        for data in changes.get("gameProfiles", []):
            self.profile(data)
        for data in changes.get("games", []):
            self.game(data)
        for data in changes.get("players", []):
            self.player(data)
        for data in changes.get("scoreEntries", []):
            self.entry(data)

    # -- Spelprofielen ------------------------------------------------------

    def profile(self, d: dict) -> None:
        existing = GameProfile.objects.filter(pk=d["id"]).first()
        if existing is None:
            GameProfile.objects.create(
                id=d["id"], owner=self.user, name=d["name"], rules=wire.rules_in(d["rules"]),
                updated_at=d["updatedAt"], deleted_at=d.get("deletedAt"), revision=self.revisions.get(),
            )
        elif existing.owner_id != self.user.pk:
            self.reject("gameProfile", d["id"], "forbidden")
        elif d["updatedAt"] > existing.updated_at:
            existing.name = d["name"]
            existing.rules = wire.rules_in(d["rules"])
            existing.updated_at = d["updatedAt"]
            existing.deleted_at = d.get("deletedAt")
            existing.revision = self.revisions.get()
            existing.save()

    # -- Spellen ------------------------------------------------------------

    def game(self, d: dict) -> None:
        existing = Game.objects.filter(pk=d["id"]).first()
        if existing is None:
            Game.objects.create(
                id=d["id"], owner=self.user, name=d["name"], profile_id=d.get("profileId"),
                rules=wire.rules_in(d["rules"]), end_turns_left=d.get("endTurnsLeft"),
                participants_can_score=d.get("participantsCanScore", False),
                created_at=d["createdAt"], updated_at=d["updatedAt"],
                finished_at=d.get("finishedAt"), deleted_at=d.get("deletedAt"),
                revision=self.revisions.get(),
            )
            return
        if d["updatedAt"] <= existing.updated_at:
            return  # Ouder dan wat de server heeft: negeren (geen fout).
        if existing.owner_id == self.user.pk:
            existing.name = d["name"]
            existing.profile_id = d.get("profileId")
            existing.rules = wire.rules_in(d["rules"])
            existing.participants_can_score = d.get("participantsCanScore", False)
            existing.deleted_at = d.get("deletedAt")
        elif not can_score(self.user, existing):
            self.reject("game", d["id"], "forbidden")
            return
        # Spelstatus: eigenaar, of deelnemer die mag boeken.
        existing.end_turns_left = d.get("endTurnsLeft")
        existing.finished_at = d.get("finishedAt")
        existing.updated_at = d["updatedAt"]
        existing.revision = self.revisions.get()
        existing.save()

    # -- Spelers (en uitnodigen) -----------------------------------------------

    def player(self, d: dict) -> None:
        game = Game.objects.filter(pk=d["gameId"]).first()
        if game is None:
            self.reject("player", d["id"], "unknown_game")
            return
        if game.owner_id != self.user.pk:
            self.reject("player", d["id"], "forbidden")
            return
        account_id = d.get("accountId")
        if account_id is not None and not User.objects.filter(pk=account_id, is_verified=True, is_active=True).exists():
            self.reject("player", d["id"], "unknown_account")
            return

        existing = Player.objects.filter(pk=d["id"]).first()
        if existing is not None and existing.game_id != game.pk:
            self.reject("player", d["id"], "game_mismatch")
            return
        if existing is not None and d["updatedAt"] <= existing.updated_at:
            return

        old_account_id = existing.account_id if existing else None
        # Wie had er toegang vóór deze wijziging? (Voor de toegangs-events.)
        new_had_access = account_id is not None and has_access(account_id, game)

        player = existing or Player(id=d["id"], game=game)
        player.name = d["name"]
        player.color = d["color"]
        player.position = d["position"]
        player.account_id = account_id
        player.updated_at = d["updatedAt"]
        player.revision = self.revisions.get()
        player.save()

        if account_id != old_account_id:
            if account_id is not None and not new_had_access:
                record_access(account_id, game.pk, granted=True, revisions=self.revisions)
            if old_account_id is not None and not has_access(old_account_id, game):
                record_access(old_account_id, game.pk, granted=False, revisions=self.revisions)

    # -- Boekingen -------------------------------------------------------------

    def entry(self, d: dict) -> None:
        existing = ScoreEntry.objects.select_related("game").filter(pk=d["id"]).first()
        if existing is not None:
            if str(existing.game_id) != str(d["gameId"]):
                self.reject("scoreEntry", d["id"], "game_mismatch")
            elif d.get("undoneAt") is not None and existing.undone_at is None:
                if not can_score(self.user, existing.game):
                    self.reject("scoreEntry", d["id"], "forbidden")
                    return
                existing.undone_at = d["undoneAt"]
                existing.revision = self.revisions.get()
                existing.save(update_fields=["undone_at", "revision"])
            return  # Verder verandert een boeking nooit.

        game = Game.objects.filter(pk=d["gameId"]).first()
        if game is None:
            self.reject("scoreEntry", d["id"], "unknown_game")
            return
        if not can_score(self.user, game):
            self.reject("scoreEntry", d["id"], "forbidden")
            return
        if not Player.objects.filter(pk=d["playerId"], game=game).exists():
            self.reject("scoreEntry", d["id"], "unknown_player")
            return
        ScoreEntry.objects.create(
            id=d["id"], game=game, player_id=d["playerId"], delta=d["delta"],
            created_at=d["createdAt"], undone_at=d.get("undoneAt"),
            created_by=self.user, revision=self.revisions.get(),
        )


def _collect(user, cursor: int, new_cursor: int) -> SyncResult:
    visible = visible_games(user)
    visible_ids = set(visible.values_list("id", flat=True))

    events = GameAccessEvent.objects.filter(user=user, revision__gt=cursor)
    # Nieuw toegankelijk: het hele spel meesturen, ook oudere records.
    granted_ids = set(events.filter(granted=True).values_list("game_id", flat=True)) & visible_ids
    removed_ids = set(events.filter(granted=False).values_list("game_id", flat=True)) - visible_ids

    changed = Q(revision__gt=cursor)
    games = list(Game.objects.filter(id__in=visible_ids).filter(changed | Q(id__in=granted_ids)))
    players = list(
        Player.objects.filter(game_id__in=visible_ids).filter(changed | Q(game_id__in=granted_ids))
    )
    entries = list(
        ScoreEntry.objects.filter(game_id__in=visible_ids).filter(changed | Q(game_id__in=granted_ids))
    )
    # Eigen profielen, plus (alleen-lezen) de profielen van gedeelde spellen die meekomen.
    shared_profile_ids = {g.profile_id for g in games if g.profile_id and g.owner_id != user.pk}
    profiles = list(
        GameProfile.objects.filter(Q(owner=user, revision__gt=cursor) | Q(id__in=shared_profile_ids))
    )

    account_ids = {g.owner_id for g in games} | {p.account_id for p in players if p.account_id}
    accounts = [
        {"id": str(a["id"]), "displayName": a["display_name"]}
        for a in User.objects.filter(pk__in=account_ids).values("id", "display_name")
    ]

    return SyncResult(
        cursor=new_cursor,
        changes={
            "games": [wire.game_out(g) for g in games],
            "players": [wire.player_out(p) for p in players],
            "scoreEntries": [wire.entry_out(e) for e in entries],
            "gameProfiles": [wire.profile_out(p) for p in profiles],
        },
        removed_game_ids=sorted(str(i) for i in removed_ids),
        accounts=accounts,
    )


def leave(user, game: Game) -> None:
    """Een deelnemer haalt zichzelf uit een gedeeld spel."""
    with transaction.atomic():
        revisions = RevisionAllocator()
        for player in Player.objects.select_for_update().filter(game=game, account=user):
            player.account = None
            player.updated_at = timezone.now()
            player.revision = revisions.get()
            player.save(update_fields=["account", "updated_at", "revision"])
        record_access(user.pk, game.pk, granted=False, revisions=revisions)
