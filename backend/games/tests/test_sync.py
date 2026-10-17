import uuid
from datetime import datetime, timedelta, timezone

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone as dj_timezone
from rest_framework.test import APIClient

from accounts.models import AuthToken, InviteCode, User

T0 = datetime(2026, 10, 16, 12, 0, tzinfo=timezone.utc)
RULES = {"scoring": "high", "timerOn": False, "timerSecs": 60, "maxScore": None, "maxRounds": None,
         "endMode": "round", "sortPlayers": True}


def ts(minutes: float = 0) -> str:
    return (T0 + timedelta(minutes=minutes)).isoformat().replace("+00:00", "Z")


def uid() -> str:
    return str(uuid.uuid4())


class Device:
    """Een toestel van een gebruiker: eigen token en eigen cursor."""

    def __init__(self, user: User):
        self.user = user
        _, key = AuthToken.create_for(user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {key}")
        self.cursor = None

    def sync(self, **changes) -> dict:
        r = self.client.post("/api/v1/sync", {"cursor": self.cursor, "changes": changes}, format="json")
        assert r.status_code == 200, r.content
        body = r.json()
        self.cursor = body["cursor"]
        return body


def make_user(name: str) -> User:
    return User.objects.create_user(f"{name.lower()}@example.com", name, is_verified=True)


def game(game_id, minutes=0, **extra) -> dict:
    return {"id": game_id, "name": "Rummikub", "rules": RULES, "createdAt": ts(0), "updatedAt": ts(minutes)} | extra


def player(player_id, game_id, name, position=0, minutes=0, account=None) -> dict:
    return {"id": player_id, "gameId": game_id, "name": name, "color": "#FF5A5F", "position": position,
            "accountId": account, "updatedAt": ts(minutes)}


def entry(entry_id, game_id, player_id, delta, minutes=0, undone=None) -> dict:
    return {"id": entry_id, "gameId": game_id, "playerId": player_id, "delta": delta,
            "createdAt": ts(minutes), "undoneAt": undone}


class SyncTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.anna = make_user("Anna")
        self.bram = make_user("Bram")
        self.owner = Device(self.anna)
        self.invitee = Device(self.bram)
        self.g = uid()
        self.p_anna, self.p_bram = uid(), uid()

    def create_game(self, bram_account=None, **game_extra):
        return self.owner.sync(
            games=[game(self.g, **game_extra)],
            players=[player(self.p_anna, self.g, "Anna", 0, account=str(self.anna.pk)),
                     player(self.p_bram, self.g, "Bram", 1, account=bram_account)],
        )


class OwnerSyncTests(SyncTestCase):
    def test_create_and_see_on_second_device(self):
        body = self.create_game()
        self.owner.sync(scoreEntries=[entry(uid(), self.g, self.p_anna, 5)])
        self.assertEqual(body["rejected"], [])

        other = Device(self.anna)
        body = other.sync()
        self.assertEqual([g["id"] for g in body["changes"]["games"]], [self.g])
        self.assertEqual(len(body["changes"]["players"]), 2)
        self.assertEqual(body["changes"]["scoreEntries"][0]["delta"], 5)
        self.assertEqual(body["changes"]["games"][0]["ownerId"], str(self.anna.pk))

        # Daarna alleen nog wat nieuw is.
        self.assertEqual(other.sync()["changes"]["games"], [])

    def test_cursor_only_returns_newer_changes(self):
        self.create_game()
        e = uid()
        body = self.owner.sync(scoreEntries=[entry(e, self.g, self.p_anna, 3)])
        self.assertEqual([x["id"] for x in body["changes"]["scoreEntries"]], [e])
        self.assertEqual(body["changes"]["games"], [])

    def test_last_writer_wins(self):
        self.create_game(minutes=10)
        self.owner.sync(games=[game(self.g, minutes=5) | {"name": "Ouder"}])
        self.owner.sync(games=[game(self.g, minutes=20) | {"name": "Nieuwer"}])
        self.assertEqual(Device(self.anna).sync()["changes"]["games"][0]["name"], "Nieuwer")

    def test_entries_are_append_only_except_undo(self):
        self.create_game()
        e = uid()
        self.owner.sync(scoreEntries=[entry(e, self.g, self.p_anna, 5)])
        self.owner.sync(scoreEntries=[entry(e, self.g, self.p_anna, 99)])
        self.owner.sync(scoreEntries=[entry(e, self.g, self.p_anna, 5, undone=ts(3))])
        got = Device(self.anna).sync()["changes"]["scoreEntries"][0]
        self.assertEqual(got["delta"], 5)
        self.assertIsNotNone(got["undoneAt"])

    def test_invalid_payload_is_rejected_as_a_whole(self):
        r = self.owner.client.post("/api/v1/sync", {"changes": {"games": [{"id": "x"}]}}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_requires_auth(self):
        self.assertEqual(APIClient().post("/api/v1/sync", {}, format="json").status_code, 401)


class InviteTests(SyncTestCase):
    def test_lookup_by_exact_email(self):
        r = self.owner.client.post("/api/v1/accounts/lookup", {"email": " BRAM@example.com"}, format="json")
        self.assertEqual(r.json(), {"id": str(self.bram.pk), "displayName": "Bram"})
        self.assertNotIn("email", r.json())
        self.assertEqual(
            self.owner.client.post("/api/v1/accounts/lookup", {"email": "bra@example.com"}, format="json").status_code, 404
        )

    def lookup_code(self, code):
        return self.owner.client.post("/api/v1/accounts/lookup", {"code": code}, format="json")

    def test_lookup_by_invite_code(self):
        r = self.invitee.client.post("/api/v1/me/invite-code")
        self.assertEqual(r.status_code, 201)
        code = r.json()["code"]
        self.assertRegex(code, r"^\d{6}$")
        self.assertEqual(self.lookup_code(f" {code} ").json(), {"id": str(self.bram.pk), "displayName": "Bram"})

        # Een nieuwe code vervangt de oude.
        newer = self.invitee.client.post("/api/v1/me/invite-code").json()["code"]
        if newer != code:
            self.assertEqual(self.lookup_code(code).status_code, 404)
        self.assertEqual(self.lookup_code(newer).status_code, 200)

    def test_invite_code_expires(self):
        code = self.invitee.client.post("/api/v1/me/invite-code").json()["code"]
        InviteCode.objects.filter(user=self.bram).update(expires_at=dj_timezone.now() - timedelta(seconds=1))
        r = self.lookup_code(code)
        self.assertEqual(r.status_code, 404)
        self.assertEqual(r.json()["code"], "invite_code_not_found")

    def test_lookup_needs_exactly_one_of_email_or_code(self):
        url = "/api/v1/accounts/lookup"
        self.assertEqual(self.owner.client.post(url, {}, format="json").status_code, 400)
        self.assertEqual(self.owner.client.post(url, {"code": "12345"}, format="json").status_code, 400)
        both = {"email": "bram@example.com", "code": "123456"}
        self.assertEqual(self.owner.client.post(url, both, format="json").status_code, 400)

    def test_unverified_accounts_get_no_invite_code(self):
        ghost = Device(User.objects.create_user("ghost@example.com", "Ghost"))
        self.assertEqual(ghost.client.post("/api/v1/me/invite-code").status_code, 403)

    def test_unverified_accounts_cannot_be_found_or_invited(self):
        ghost = User.objects.create_user("ghost@example.com", "Ghost")
        r = self.owner.client.post("/api/v1/accounts/lookup", {"email": "ghost@example.com"}, format="json")
        self.assertEqual(r.status_code, 404)
        body = self.create_game(bram_account=str(ghost.pk))
        self.assertEqual(body["rejected"], [{"type": "player", "id": self.p_bram, "reason": "unknown_account"}])

    def test_invitee_gets_whole_game_including_older_entries(self):
        self.create_game()
        old = uid()
        self.owner.sync(scoreEntries=[entry(old, self.g, self.p_anna, 7)])
        # Bram synct eerst (ziet niets) en wordt pas daarna uitgenodigd.
        self.assertEqual(self.invitee.sync()["changes"]["games"], [])
        self.owner.sync(players=[player(self.p_bram, self.g, "Bram", 1, minutes=1, account=str(self.bram.pk))])

        body = self.invitee.sync()
        self.assertEqual([g["id"] for g in body["changes"]["games"]], [self.g])
        self.assertEqual([e["id"] for e in body["changes"]["scoreEntries"]], [old])
        self.assertEqual({a["displayName"] for a in body["accounts"]}, {"Anna", "Bram"})

    def test_strangers_see_nothing_and_cannot_write(self):
        self.create_game()
        stranger = Device(make_user("Cas"))
        self.assertEqual(stranger.sync()["changes"]["games"], [])
        body = stranger.sync(
            games=[game(self.g, minutes=30) | {"name": "Gekaapt"}],
            scoreEntries=[entry(uid(), self.g, self.p_anna, 100)],
        )
        self.assertEqual({r["reason"] for r in body["rejected"]}, {"forbidden"})
        self.assertEqual(Device(self.anna).sync()["changes"]["games"][0]["name"], "Rummikub")


class ParticipantScoringTests(SyncTestCase):
    def test_participant_cannot_score_by_default(self):
        self.create_game(bram_account=str(self.bram.pk))
        body = self.invitee.sync(scoreEntries=[entry(uid(), self.g, self.p_bram, 5)])
        self.assertEqual(body["rejected"][0]["reason"], "forbidden")

    def test_participant_can_score_when_enabled(self):
        self.create_game(bram_account=str(self.bram.pk), participantsCanScore=True)
        e = uid()
        body = self.invitee.sync(scoreEntries=[entry(e, self.g, self.p_bram, 5)])
        self.assertEqual(body["rejected"], [])
        self.assertEqual(body["changes"]["scoreEntries"][0]["createdBy"], str(self.bram.pk))
        self.invitee.sync(scoreEntries=[entry(e, self.g, self.p_bram, 5, undone=ts(2))])
        self.assertIsNotNone(self.owner.sync()["changes"]["scoreEntries"][0]["undoneAt"])

    def test_participant_may_update_game_state_but_not_settings(self):
        self.create_game(bram_account=str(self.bram.pk), participantsCanScore=True)
        self.invitee.sync(games=[game(self.g, minutes=5, participantsCanScore=True) | {
            "name": "Andere naam", "finishedAt": ts(5), "rules": RULES | {"scoring": "low"},
            "stayOnOwnPlayer": True,
        }])
        got = self.owner.sync()["changes"]["games"][0]
        self.assertEqual(got["finishedAt"], ts(5).replace("Z", ".000Z"))
        self.assertEqual(got["name"], "Rummikub")
        self.assertEqual(got["rules"]["scoring"], "high")
        self.assertFalse(got["stayOnOwnPlayer"])

    def test_stay_on_own_player_survives_clients_without_the_field(self):
        self.create_game(bram_account=str(self.bram.pk), participantsCanScore=True, stayOnOwnPlayer=True)
        self.assertTrue(self.invitee.sync()["changes"]["games"][0]["stayOnOwnPlayer"])
        # Een oudere app kent het veld niet en stuurt het dus niet mee.
        self.owner.sync(games=[game(self.g, minutes=5, participantsCanScore=True) | {"name": "Nieuw"}])
        got = self.invitee.sync()["changes"]["games"][0]
        self.assertEqual(got["name"], "Nieuw")
        self.assertTrue(got["stayOnOwnPlayer"])
        self.owner.sync(games=[game(self.g, minutes=6, participantsCanScore=True, stayOnOwnPlayer=False)])
        self.assertFalse(self.invitee.sync()["changes"]["games"][0]["stayOnOwnPlayer"])

    def test_participant_cannot_change_players(self):
        self.create_game(bram_account=str(self.bram.pk), participantsCanScore=True)
        body = self.invitee.sync(players=[player(self.p_anna, self.g, "Hacker", 0, minutes=9)])
        self.assertEqual(body["rejected"][0]["reason"], "forbidden")


class AccessRemovalTests(SyncTestCase):
    def setUp(self):
        super().setUp()
        self.create_game(bram_account=str(self.bram.pk))
        self.invitee.sync()

    def test_leave_game(self):
        r = self.invitee.client.post(f"/api/v1/games/{self.g}/leave")
        self.assertEqual(r.status_code, 204)
        body = self.invitee.sync()
        self.assertEqual(body["removedGameIds"], [self.g])
        self.assertEqual(body["changes"]["games"], [])
        players = {p["id"]: p for p in self.owner.sync()["changes"]["players"]}
        self.assertIsNone(players[self.p_bram]["accountId"])

    def test_owner_cannot_leave(self):
        r = self.owner.client.post(f"/api/v1/games/{self.g}/leave")
        self.assertEqual(r.json()["code"], "owner_cannot_leave")

    def test_owner_unlinks_player(self):
        self.owner.sync(players=[player(self.p_bram, self.g, "Bram", 1, minutes=5)])
        self.assertEqual(self.invitee.sync()["removedGameIds"], [self.g])

    def test_owner_deletes_account(self):
        self.owner.client.delete("/api/v1/me")
        body = self.invitee.sync()
        self.assertEqual(body["removedGameIds"], [self.g])

    def test_regranted_access_sends_whole_game_again(self):
        self.invitee.client.post(f"/api/v1/games/{self.g}/leave")
        self.invitee.sync()
        # Opnieuw uitnodigen gebeurt na het vertrek (dat de servertijd kreeg).
        later = (datetime.now(timezone.utc) - T0).total_seconds() / 60 + 1
        self.owner.sync(players=[player(self.p_bram, self.g, "Bram", 1, minutes=later, account=str(self.bram.pk))])
        body = self.invitee.sync()
        self.assertEqual(body["removedGameIds"], [])
        self.assertEqual(len(body["changes"]["players"]), 2)


class ProfileTests(SyncTestCase):
    def test_profiles_sync_between_own_devices(self):
        pr = uid()
        self.owner.sync(gameProfiles=[{"id": pr, "name": "Golf", "rules": RULES, "updatedAt": ts(0)}])
        self.assertEqual(Device(self.anna).sync()["changes"]["gameProfiles"][0]["name"], "Golf")
        self.assertEqual(self.invitee.sync()["changes"]["gameProfiles"], [])

    def test_profile_of_shared_game_is_visible_read_only(self):
        pr = uid()
        self.owner.sync(gameProfiles=[{"id": pr, "name": "Golf", "rules": RULES, "updatedAt": ts(0)}])
        self.create_game(bram_account=str(self.bram.pk), profileId=pr)
        got = self.invitee.sync()["changes"]["gameProfiles"]
        self.assertEqual([(p["id"], p["ownerId"]) for p in got], [(pr, str(self.anna.pk))])

        body = self.invitee.sync(gameProfiles=[{"id": pr, "name": "Mijn golf", "rules": RULES, "updatedAt": ts(9)}])
        self.assertEqual(body["rejected"][0]["reason"], "forbidden")


class TransferTests(SyncTestCase):
    def transfer(self, device, body):
        return device.client.post(f"/api/v1/games/{self.g}/transfer", body, format="json")

    def test_owner_transfers_to_participant_and_keeps_playing(self):
        self.create_game(bram_account=str(self.bram.pk))  # Anna is gekoppeld aan haar speler
        self.owner.sync()
        self.invitee.sync()
        r = self.transfer(self.owner, {"accountId": str(self.bram.pk)})
        self.assertEqual(r.status_code, 204)

        got = self.invitee.sync()["changes"]["games"][0]
        self.assertEqual(got["ownerId"], str(self.bram.pk))
        # Anna ziet het spel nog (als deelnemer) en kan de spelers niet meer wijzigen.
        anna = self.owner.sync()
        self.assertEqual(anna["changes"]["games"][0]["ownerId"], str(self.bram.pk))
        body = self.owner.sync(players=[player(self.p_bram, self.g, "X", 1, minutes=60)])
        self.assertEqual(body["rejected"][0]["reason"], "forbidden")
        # Bram kan nu als eigenaar de instellingen wijzigen.
        later = (datetime.now(timezone.utc) - T0).total_seconds() / 60 + 1
        body = self.invitee.sync(games=[game(self.g, minutes=later, participantsCanScore=True)])
        self.assertEqual(body["rejected"], [])

    def test_owner_without_player_must_pick_one(self):
        self.owner.sync(
            games=[game(self.g)],
            players=[player(self.p_anna, self.g, "Anna", 0), player(self.p_bram, self.g, "Bram", 1, account=str(self.bram.pk))],
        )
        r = self.transfer(self.owner, {"accountId": str(self.bram.pk)})
        self.assertEqual(r.json()["code"], "owner_player_required")
        r = self.transfer(self.owner, {"accountId": str(self.bram.pk), "ownerPlayerId": self.p_anna})
        self.assertEqual(r.status_code, 204)
        players = {p["id"]: p for p in self.owner.sync()["changes"]["players"]}
        self.assertEqual(players[self.p_anna]["accountId"], str(self.anna.pk))
        self.assertEqual(self.owner.sync()["removedGameIds"], [])

    def test_only_to_linked_players_and_only_by_owner(self):
        self.create_game(bram_account=str(self.bram.pk))
        cas = make_user("Cas")
        self.assertEqual(self.transfer(self.owner, {"accountId": str(cas.pk)}).json()["code"], "not_a_participant")
        self.assertEqual(self.transfer(self.owner, {"accountId": str(self.anna.pk)}).json()["code"], "already_owner")
        self.assertEqual(self.transfer(self.invitee, {"accountId": str(self.bram.pk)}).status_code, 403)
        self.assertEqual(self.transfer(Device(cas), {"accountId": str(cas.pk)}).status_code, 404)

    def test_new_owner_receives_profile_read_only(self):
        pr = uid()
        self.owner.sync(gameProfiles=[{"id": pr, "name": "Golf", "rules": RULES, "updatedAt": ts(0)}])
        self.create_game(bram_account=str(self.bram.pk), profileId=pr)
        self.invitee.sync()
        self.transfer(self.owner, {"accountId": str(self.bram.pk)})
        got = self.invitee.sync()["changes"]["gameProfiles"]
        self.assertEqual([p["id"] for p in got], [pr])
