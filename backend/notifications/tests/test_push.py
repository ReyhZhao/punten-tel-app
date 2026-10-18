import json
from unittest import mock

import httpx
import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from django.core.cache import cache
from django.test import TestCase, override_settings

from accounts.models import AuthToken
from games.tests.test_sync import RULES, Device, SyncTestCase, entry, game, player, ts, uid
from notifications.apns import APNsClient
from notifications.models import PushDevice

KEY = ec.generate_private_key(ec.SECP256R1())
PEM = KEY.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
TOKEN_A = "a" * 64
TOKEN_B = "b" * 64


class APNsClientTests(TestCase):
    def client_with(self, handler):
        return APNsClient("KEY123", "TEAM456", PEM, "online.vels.puntenteller", transport=httpx.MockTransport(handler))

    def test_sends_signed_request_to_apple(self):
        seen = {}

        def handler(request):
            seen["url"] = str(request.url)
            seen["headers"] = request.headers
            seen["body"] = json.loads(request.content)
            return httpx.Response(200)

        result = self.client_with(handler).send(TOKEN_A, "sandbox", {"aps": {"alert": "hoi"}}, collapse_id="x")
        self.assertIsNone(result)
        self.assertEqual(seen["url"], f"https://api.sandbox.push.apple.com/3/device/{TOKEN_A}")
        self.assertEqual(seen["headers"]["apns-topic"], "online.vels.puntenteller")
        self.assertEqual(seen["headers"]["apns-push-type"], "alert")
        self.assertEqual(seen["headers"]["apns-collapse-id"], "x")
        token = seen["headers"]["authorization"].removeprefix("bearer ")
        self.assertEqual(jwt.get_unverified_header(token)["kid"], "KEY123")
        claims = jwt.decode(token, KEY.public_key(), algorithms=["ES256"])
        self.assertEqual(claims["iss"], "TEAM456")
        self.assertEqual(seen["body"], {"aps": {"alert": "hoi"}})

    def test_returns_apple_reason_on_failure(self):
        client = self.client_with(lambda r: httpx.Response(410, json={"reason": "Unregistered"}))
        self.assertEqual(client.send(TOKEN_A, "production", {}), "Unregistered")

    def test_reuses_auth_token(self):
        tokens = []
        client = self.client_with(lambda r: tokens.append(r.headers["authorization"]) or httpx.Response(200))
        client.send(TOKEN_A, "production", {})
        client.send(TOKEN_B, "production", {})
        self.assertEqual(tokens[0], tokens[1])


class DeviceRegistrationTests(SyncTestCase):
    def test_register_update_and_unregister(self):
        r = self.owner.client.post("/api/v1/push/devices", {"token": TOKEN_A.upper(), "environment": "sandbox"}, format="json")
        self.assertEqual(r.status_code, 204)
        device = PushDevice.objects.get()
        self.assertEqual((device.user, device.token, device.environment), (self.anna, TOKEN_A, "sandbox"))
        # Zelfde token, ander account (toestel van eigenaar gewisseld): wordt overgenomen.
        self.invitee.client.post("/api/v1/push/devices", {"token": TOKEN_A}, format="json")
        self.assertEqual(PushDevice.objects.get().user, self.bram)
        self.assertEqual(self.owner.client.delete(f"/api/v1/push/devices/{TOKEN_A}").status_code, 404)
        self.assertEqual(self.invitee.client.delete(f"/api/v1/push/devices/{TOKEN_A}").status_code, 204)
        self.assertFalse(PushDevice.objects.exists())

    def test_rejects_invalid_token(self):
        r = self.owner.client.post("/api/v1/push/devices", {"token": "geen-hex"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_devices_per_user_are_capped(self):
        for i in range(25):
            self.owner.client.post("/api/v1/push/devices", {"token": f"{i:064x}"}, format="json")
        tokens = set(PushDevice.objects.filter(user=self.anna).values_list("token", flat=True))
        self.assertEqual(len(tokens), 20)
        self.assertIn(f"{24:064x}", tokens)
        self.assertNotIn(f"{0:064x}", tokens)

    def test_logout_removes_device(self):
        self.owner.client.post("/api/v1/push/devices", {"token": TOKEN_A}, format="json")
        self.owner.client.post("/api/v1/auth/logout")
        self.assertFalse(PushDevice.objects.exists())


class FakeAPNs:
    def __init__(self, dead=()):
        self.sent = []
        self.dead = set(dead)

    def send(self, token, environment, payload, collapse_id=None):
        self.sent.append((token, payload))
        return "Unregistered" if token in self.dead else None


@override_settings(PUSH_ASYNC=False)
class PushTriggerTests(SyncTestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.owner.client.post("/api/v1/push/devices", {"token": TOKEN_A}, format="json")
        self.invitee.client.post("/api/v1/push/devices", {"token": TOKEN_B}, format="json")
        self.apns = FakeAPNs()
        patcher = mock.patch("notifications.service.get_client", return_value=self.apns)
        patcher.start()
        self.addCleanup(patcher.stop)

    def run_and_collect(self, action):
        self.apns.sent.clear()
        with self.captureOnCommitCallbacks(execute=True):
            action()
        return [(token, p["kind"], p["aps"]["alert"]["body"], p["gameId"]) for token, p in self.apns.sent]

    def test_invite_notifies_only_the_invitee(self):
        sent = self.run_and_collect(lambda: self.create_game(bram_account=str(self.bram.pk)))
        self.assertEqual(sent, [(TOKEN_B, "invited", "Anna heeft je toegevoegd aan dit spel.", self.g)])
        # Opnieuw opslaan zonder nieuwe koppeling: geen nieuwe melding.
        sent = self.run_and_collect(lambda: self.owner.sync(players=[player(self.p_bram, self.g, "Bram", 1, minutes=9, account=str(self.bram.pk))]))
        self.assertEqual(sent, [])

    def test_finishing_notifies_others_with_winner(self):
        self.create_game(bram_account=str(self.bram.pk))
        self.owner.sync(scoreEntries=[entry(uid(), self.g, self.p_anna, 10), entry(uid(), self.g, self.p_bram, 25)])
        sent = self.run_and_collect(lambda: self.owner.sync(games=[game(self.g, minutes=5, finishedAt=ts(5))]))
        self.assertEqual(sent, [(TOKEN_B, "finished", "Afgelopen — Bram wint met 25 punten.", self.g)])
        # Nog een keer afgerond opslaan: geen tweede melding.
        sent = self.run_and_collect(lambda: self.owner.sync(games=[game(self.g, minutes=6, finishedAt=ts(5))]))
        self.assertEqual(sent, [])

    def test_lowest_score_wins_in_low_games(self):
        low = RULES | {"scoring": "low"}
        self.create_game(bram_account=str(self.bram.pk), rules=low)
        self.owner.sync(scoreEntries=[entry(uid(), self.g, self.p_anna, 10), entry(uid(), self.g, self.p_bram, 25)])
        sent = self.run_and_collect(lambda: self.owner.sync(games=[game(self.g, minutes=5, finishedAt=ts(5), rules=low)]))
        self.assertEqual(sent[0][2], "Afgelopen — Anna wint met 10 punten.")

    def test_transfer_notifies_new_owner(self):
        self.create_game(bram_account=str(self.bram.pk))
        sent = self.run_and_collect(lambda: self.owner.client.post(
            f"/api/v1/games/{self.g}/transfer", {"accountId": str(self.bram.pk)}, format="json"))
        self.assertEqual(sent, [(TOKEN_B, "transferred", "Anna heeft dit spel aan jou overgedragen.", self.g)])

    def test_dead_tokens_are_removed(self):
        self.apns.dead = {TOKEN_B}
        self.run_and_collect(lambda: self.create_game(bram_account=str(self.bram.pk)))
        self.assertEqual(list(PushDevice.objects.values_list("token", flat=True)), [TOKEN_A])

    def test_nothing_happens_without_apns_key(self):
        with mock.patch("notifications.service.get_client", return_value=None):
            self.apns.sent.clear()
            with self.captureOnCommitCallbacks(execute=True):
                self.create_game(bram_account=str(self.bram.pk))
        self.assertEqual(self.apns.sent, [])
