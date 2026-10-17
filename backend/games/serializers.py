"""
Het JSON-formaat van de sync-API. Gelijk aan de Codable-modellen in
ios/PuntentellerKit (camelCase, ISO-8601-tijden), maar als platte lijsten.
"""

from rest_framework import serializers

COLOR_REGEX = r"^#[0-9A-Fa-f]{6}$"


class RulesSerializer(serializers.Serializer):
    scoring = serializers.ChoiceField(choices=["high", "low"])
    timerOn = serializers.BooleanField()
    timerSecs = serializers.IntegerField(min_value=1, max_value=3600)
    maxScore = serializers.IntegerField(required=False, allow_null=True)
    maxRounds = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    endMode = serializers.ChoiceField(choices=["immediate", "round", "extraTurn"])
    sortPlayers = serializers.BooleanField()


class GameInSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField(max_length=80)
    profileId = serializers.UUIDField(required=False, allow_null=True)
    rules = RulesSerializer()
    endTurnsLeft = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    participantsCanScore = serializers.BooleanField(required=False, default=False)
    # Geen default: oudere apps sturen het veld niet en mogen het dan niet resetten.
    stayOnOwnPlayer = serializers.BooleanField(required=False)
    createdAt = serializers.DateTimeField()
    updatedAt = serializers.DateTimeField()
    finishedAt = serializers.DateTimeField(required=False, allow_null=True)
    deletedAt = serializers.DateTimeField(required=False, allow_null=True)


class PlayerInSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    gameId = serializers.UUIDField()
    name = serializers.CharField(max_length=40)
    color = serializers.RegexField(COLOR_REGEX)
    position = serializers.IntegerField(min_value=0, max_value=100)
    accountId = serializers.UUIDField(required=False, allow_null=True)
    updatedAt = serializers.DateTimeField()


class ScoreEntryInSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    gameId = serializers.UUIDField()
    playerId = serializers.UUIDField()
    delta = serializers.IntegerField(min_value=-1_000_000, max_value=1_000_000)
    createdAt = serializers.DateTimeField()
    undoneAt = serializers.DateTimeField(required=False, allow_null=True)


class GameProfileInSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField(max_length=80)
    rules = RulesSerializer()
    updatedAt = serializers.DateTimeField()
    deletedAt = serializers.DateTimeField(required=False, allow_null=True)


class ChangesSerializer(serializers.Serializer):
    games = GameInSerializer(many=True, required=False, default=list)
    players = PlayerInSerializer(many=True, required=False, default=list)
    scoreEntries = ScoreEntryInSerializer(many=True, required=False, default=list)
    gameProfiles = GameProfileInSerializer(many=True, required=False, default=list)


MAX_RECORDS_PER_SYNC = 5000


class SyncRequestSerializer(serializers.Serializer):
    cursor = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    changes = ChangesSerializer(required=False)

    def validate_changes(self, value):
        if sum(len(v) for v in value.values()) > MAX_RECORDS_PER_SYNC:
            raise serializers.ValidationError(f"Maximaal {MAX_RECORDS_PER_SYNC} records per sync.")
        return value


def iso(dt):
    return None if dt is None else dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def game_out(g) -> dict:
    return {
        "id": str(g.id), "ownerId": str(g.owner_id), "name": g.name,
        "profileId": str(g.profile_id) if g.profile_id else None, "rules": g.rules,
        "endTurnsLeft": g.end_turns_left, "participantsCanScore": g.participants_can_score,
        "stayOnOwnPlayer": g.stay_on_own_player,
        "createdAt": iso(g.created_at), "updatedAt": iso(g.updated_at),
        "finishedAt": iso(g.finished_at), "deletedAt": iso(g.deleted_at),
    }


def player_out(p) -> dict:
    return {
        "id": str(p.id), "gameId": str(p.game_id), "name": p.name, "color": p.color,
        "position": p.position, "accountId": str(p.account_id) if p.account_id else None,
        "updatedAt": iso(p.updated_at),
    }


def entry_out(e) -> dict:
    return {
        "id": str(e.id), "gameId": str(e.game_id), "playerId": str(e.player_id), "delta": e.delta,
        "createdAt": iso(e.created_at), "undoneAt": iso(e.undone_at),
        "createdBy": str(e.created_by_id) if e.created_by_id else None,
    }


def profile_out(p) -> dict:
    return {
        "id": str(p.id), "ownerId": str(p.owner_id), "name": p.name, "rules": p.rules,
        "updatedAt": iso(p.updated_at), "deletedAt": iso(p.deleted_at),
    }


def rules_in(data: dict) -> dict:
    """Genormaliseerde spelregels (ontbrekende optionele velden als null)."""
    return {
        "scoring": data["scoring"], "timerOn": data["timerOn"], "timerSecs": data["timerSecs"],
        "maxScore": data.get("maxScore"), "maxRounds": data.get("maxRounds"),
        "endMode": data["endMode"], "sortPlayers": data["sortPlayers"],
    }
