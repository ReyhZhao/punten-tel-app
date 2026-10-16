"""Wie mag wat zien en doen bij een spel."""

from django.db.models import Q, QuerySet

from .models import Game, GameAccessEvent, Player
from .revisions import RevisionAllocator


def visible_games(user) -> QuerySet[Game]:
    """Eigen spellen en spellen waarin je als speler gekoppeld bent."""
    return Game.objects.filter(Q(owner=user) | Q(players__account=user)).distinct()


def has_access(user_id, game: Game) -> bool:
    return game.owner_id == user_id or Player.objects.filter(game=game, account_id=user_id).exists()


def can_score(user, game: Game) -> bool:
    """De eigenaar altijd; gekoppelde spelers als de eigenaar dat aanzet."""
    if game.deleted_at is not None:
        return False
    if game.owner_id == user.pk:
        return True
    return game.participants_can_score and Player.objects.filter(game=game, account=user).exists()


def record_access(user_id, game_id, granted: bool, revisions: RevisionAllocator) -> None:
    GameAccessEvent.objects.create(user_id=user_id, game_id=game_id, granted=granted, revision=revisions.get())


def revoke_all_for_owner(owner) -> None:
    """Bij het verwijderen van een account: deelnemers verliezen de spellen ervan."""
    revisions = RevisionAllocator()
    linked = (
        Player.objects.filter(game__owner=owner, account__isnull=False)
        .exclude(account=owner)
        .values_list("account_id", "game_id")
        .distinct()
    )
    for account_id, game_id in linked:
        record_access(account_id, game_id, granted=False, revisions=revisions)
