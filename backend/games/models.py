"""
Gesyncte gegevens, in hetzelfde model als de iOS-app (ADR-0002): id's zijn
UUID's die de client aanmaakt, het logboek (`ScoreEntry`) is de bron van
waarheid, en verwijderen gebeurt met tombstones (`deleted_at`, `undone_at`).

Elke wijziging krijgt een `revision` uit één oplopende teller. De client
onthoudt de hoogste revisie die hij gezien heeft (de cursor) en vraagt
daarna alleen wat nieuwer is. Zie games/sync.py.
"""

from django.conf import settings
from django.db import models


class SyncRevision(models.Model):
    """Eén rij (pk=1) met de laatst uitgegeven revisie."""

    value = models.BigIntegerField(default=0)


class Game(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_games")
    name = models.CharField(max_length=80)
    profile_id = models.UUIDField(null=True, blank=True)
    rules = models.JSONField()
    end_turns_left = models.IntegerField(null=True, blank=True)
    # "Deelnemers mogen scores bijhouden": gekoppelde spelers mogen dan ook boeken.
    participants_can_score = models.BooleanField(default=False)
    # "Invoer op eigen speler": bij boeken blijft de invoer op je eigen speler staan.
    stay_on_own_player = models.BooleanField(default=False)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    finished_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    revision = models.BigIntegerField(db_index=True)

    class Meta:
        verbose_name = "spel"
        verbose_name_plural = "spellen"

    def __str__(self) -> str:
        return self.name


class Player(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="players")
    name = models.CharField(max_length=40)
    color = models.CharField(max_length=7)
    position = models.PositiveSmallIntegerField(default=0)
    # Gekoppeld account (uitgenodigde speler); die ziet het spel dan ook.
    account = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="game_players"
    )
    updated_at = models.DateTimeField()
    revision = models.BigIntegerField(db_index=True)

    class Meta:
        ordering = ["position"]
        verbose_name = "speler"
        verbose_name_plural = "spelers"

    def __str__(self) -> str:
        return self.name


class ScoreEntry(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="entries")
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="entries")
    delta = models.IntegerField()
    created_at = models.DateTimeField()
    undone_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    revision = models.BigIntegerField(db_index=True)

    class Meta:
        verbose_name = "boeking"
        verbose_name_plural = "boekingen"


class GameProfile(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="game_profiles")
    name = models.CharField(max_length=80)
    rules = models.JSONField()
    updated_at = models.DateTimeField()
    deleted_at = models.DateTimeField(null=True, blank=True)
    revision = models.BigIntegerField(db_index=True)

    class Meta:
        verbose_name = "spelprofiel"
        verbose_name_plural = "spelprofielen"

    def __str__(self) -> str:
        return self.name


class GameAccessEvent(models.Model):
    """
    Iemand kreeg of verloor toegang tot een spel (uitgenodigd, verwijderd,
    zelf vertrokken, eigenaar weg). Bij toegang krijgt de client het hele spel,
    ook oudere boekingen; bij verlies een `removedGameIds`. `game_id` is geen
    foreign key, zodat het event het verwijderen van het spel overleeft.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="access_events")
    game_id = models.UUIDField()
    granted = models.BooleanField()
    revision = models.BigIntegerField()

    class Meta:
        indexes = [models.Index(fields=["user", "revision"])]

