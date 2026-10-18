import io
import json
import re
from unittest import mock

import httpx
from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from games.tests.test_sync import Device, SyncTestCase, entry, make_user, uid
from polaris import client, detections
from polaris.assets import snapshot
from polaris.throttling import ReportingScopedRateThrottle
from polaris.management.commands.polaris_test_events import test_alerts

ALERT_URL = "https://polaris.test/api/ingest/00000000-0000-4000-8000-00000000a1e7/"
ASSET_URL = "https://polaris.test/api/ingest/00000000-0000-4000-8000-0000000a55e7/"
REQUIRED = {"event_id", "occurred_at", "rule", "severity", "title", "entities"}


class PolarisTestCase(TestCase):
    """Fake Polaris: verzamelt elke POST; `self.status` bepaalt het antwoord."""

    def setUp(self):
        super().setUp()
        cache.clear()
        client.reset()
        self.requests = []
        self.status = 202

        def handler(request):
            self.requests.append(request)
            if isinstance(self.status, Exception):
                raise self.status
            return httpx.Response(self.status, json={"captured_payload": len(self.requests)})

        patcher = mock.patch.object(client, "TRANSPORT", httpx.MockTransport(handler))
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(client.reset)

    def sent(self, key="events") -> list[dict]:
        client.flush_all(force=True)
        out = []
        for r in self.requests:
            body = json.loads(r.content)
            out += body.get(key, [])
        return out

    def forget(self) -> None:
        """Wat tot nu toe gebufferd of verstuurd is vergeten."""
        client.reset()
        self.requests.clear()

    def rule_ids(self) -> list[str]:
        return [e["rule"]["id"] for e in self.sent()]


SETTINGS = dict(POLARIS_ALERT_INGEST_URL=ALERT_URL, POLARIS_ASSET_INGEST_URL=ASSET_URL, POLARIS_ASYNC=False,
                POLARIS_HOST_NAME="k8s-node-01", POLARIS_HOST_IP="10.0.4.21", POLARIS_ENVIRONMENT="production",
                APP_VERSION="0.5.0")


@override_settings(**SETTINGS)
class PayloadTests(PolarisTestCase):
    def test_alert_has_the_recommended_shape(self):
        alert = detections.report(detections.LOGIN_CODE_BRUTEFORCE, "t", "d", user="a@example.com", ip="203.0.113.9")
        self.assertTrue(REQUIRED <= alert.keys())
        self.assertEqual(alert["entities"], {"host": {"name": "k8s-node-01"}, "source": {"ip": "203.0.113.9"},
                                             "user": {"name": "a@example.com"}})
        self.assertEqual(alert["app"], {"name": "puntenteller-api", "environment": "production", "version": "0.5.0"})
        self.assertRegex(alert["occurred_at"], r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")
        self.assertEqual(self.sent(), [alert])
        self.assertEqual(self.requests[0].headers["content-type"], "application/json")

    def test_rule_ids_are_stable_and_namespaced(self):
        ids = [r.id for r in detections.RULES]
        self.assertEqual(len(ids), len(set(ids)))
        for rule in detections.RULES:
            self.assertRegex(rule.id, r"^puntenteller-api\.[a-z]+\.[a-z-]+$")
            self.assertIn(rule.severity, client.SEVERITIES)
            self.assertTrue(rule.when and rule.guidance)

    @override_settings(POLARIS_HOST_NAME="")
    def test_unknown_values_are_omitted_not_sent_empty(self):
        self.assertEqual(client.entities(user="", ip="unknown"), {})
        self.assertEqual(client.entities(user="a@example.com", ip="-"), {"user": {"name": "a@example.com"}})
        with self.assertRaises(ValueError):
            client.make_alert(detections.RATE_LIMITED, "t", "d", {})

    def test_title_is_capped(self):
        alert = detections.report(detections.RATE_LIMITED, "x" * 400, "d", ip="203.0.113.9")
        self.assertEqual(len(alert["title"]), 255)

    def test_test_command_emits_one_event_per_rule(self):
        alerts = test_alerts()
        self.assertEqual([a["rule"]["id"] for a in alerts], [r.id for r in detections.RULES])
        self.assertEqual({a["app"]["environment"] for a in alerts}, {"test"})
        self.assertEqual(len({a["event_id"] for a in alerts}), len(alerts))
        out = io.StringIO()
        call_command("polaris_test_events", stdout=out)
        self.assertEqual(len(self.sent()), len(detections.RULES))
        self.assertIn("ontvangen door Polaris (events …a1e7)", out.getvalue())


@override_settings(**SETTINGS)
class TransportTests(PolarisTestCase):
    def queue(self, n=1, severity="medium"):
        s = client.sender("events")
        for i in range(n):
            s.enqueue({"event_id": f"e{i}", "severity": severity})
        return s

    def test_retryable_failures_keep_the_batch_with_the_same_ids(self):
        for failure in (500, 503, 429, httpx.ConnectTimeout("boom")):
            client.reset()
            self.requests.clear()
            self.status = failure
            s = self.queue(3)
            self.assertFalse(s.flush())
            self.assertEqual(s.pending(), 3)
            self.assertFalse(s.flush(), "backoff: niet meteen opnieuw")
            self.assertEqual(len(self.requests), 1)
            self.status = 202
            self.assertTrue(s.flush(force=True))
            self.assertEqual(json.loads(self.requests[0].content), json.loads(self.requests[-1].content))

    def test_rejections_are_dropped_and_logged_without_the_url(self):
        for code in (400, 404):
            client.reset()
            self.status = code
            s = self.queue(2)
            with self.assertLogs("polaris.client", "ERROR") as logs:
                self.assertTrue(s.flush())
            self.assertEqual(s.pending(), 0)
            self.assertIn(f"HTTP {code}", logs.output[0])
            self.assertIn("…a1e7", logs.output[0])
            self.assertNotIn("00000000-0000", logs.output[0])

    @override_settings(POLARIS_OPS_EMAIL="ops@example.com")
    def test_rejection_mails_the_operator_once(self):
        self.status = 404
        for _ in range(3):
            self.queue(1)
            with self.assertLogs("polaris.client", "ERROR"):
                client.flush_all(force=True)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["ops@example.com"])
        self.assertIn("HTTP 404", mail.outbox[0].body)
        self.assertIn("…a1e7", mail.outbox[0].body)
        self.assertNotIn("00000000-0000", mail.outbox[0].body)

    @override_settings(POLARIS_OPS_EMAIL="ops@example.com")
    def test_long_outage_mails_the_operator(self):
        self.status = 503
        s = self.queue(1)
        clock = [1000.0]
        with mock.patch.object(client.time, "monotonic", lambda: clock[0]):
            s.flush(force=True)
            clock[0] += client.OPS_UNREACHABLE_AFTER - 1
            s.flush(force=True)
            self.assertEqual(mail.outbox, [], "nog geen half uur")
            clock[0] += 2
            s.flush(force=True)
            self.assertEqual(len(mail.outbox), 1)
            self.assertIn("onbereikbaar", mail.outbox[0].subject)
            self.status = 202
            self.assertTrue(s.flush(force=True))
            self.status = 503
            s.enqueue({"event_id": "x", "severity": "low"})
            clock[0] += 1
            s.flush(force=True)
        self.assertEqual(len(mail.outbox), 1, "na herstel begint de klok opnieuw")

    def test_no_operator_mail_without_address(self):
        self.status = 404
        self.queue(1)
        with self.assertLogs("polaris.client", "ERROR"):
            client.flush_all(force=True)
        self.assertEqual(mail.outbox, [])

    def test_413_splits_the_batch(self):
        s = self.queue(4)
        calls = []

        def handler(request):
            n = len(json.loads(request.content)["events"])
            calls.append(n)
            return httpx.Response(413 if n > 1 else 202, json={"captured_payload": 1})

        s._client = httpx.Client(transport=httpx.MockTransport(handler))
        self.assertTrue(s.flush())
        self.assertEqual(calls, [4, 2, 1, 1, 2, 1, 1])

    def test_large_batches_are_split_before_sending(self):
        s = client.sender("events")
        for i in range(3):
            s.enqueue({"event_id": str(i), "severity": "low", "context": {"blob": "x" * 300_000}})
        self.assertTrue(s.flush())
        self.assertGreater(len(self.requests), 1)
        self.assertTrue(all(len(r.content) <= client.MAX_BODY_BYTES for r in self.requests))
        self.assertEqual(len(self.sent()), 3)

    def test_full_buffer_drops_lowest_severity_first(self):
        s = client.sender("events")
        with mock.patch.object(client, "MAX_BUFFER", 3):
            s.enqueue({"event_id": "low-old", "severity": "low"})
            s.enqueue({"event_id": "high", "severity": "high"})
            s.enqueue({"event_id": "low-new", "severity": "low"})
            with self.assertLogs("polaris.client", "WARNING"):
                s.enqueue({"event_id": "medium", "severity": "medium"})
        self.assertEqual([e["event_id"] for e in self.sent()], ["high", "low-new", "medium"])

    @override_settings(POLARIS_ALERT_INGEST_URL="http://polaris.test/api/ingest/x/")
    def test_plain_http_disables_the_integration(self):
        with self.assertLogs("polaris.client", "ERROR"):
            self.assertIsNone(client.sender("events"))

    @override_settings(POLARIS_ALERT_INGEST_URL="", POLARIS_ASSET_INGEST_URL="")
    def test_unset_urls_disable_everything(self):
        detections.report(detections.RATE_LIMITED, "t", "d", ip="203.0.113.9")
        self.assertFalse(client.enabled())
        self.assertEqual(self.sent(), [])


@override_settings(**SETTINGS)
class LoginDetectionTests(PolarisTestCase):
    def setUp(self):
        super().setUp()
        self.api = APIClient(REMOTE_ADDR="203.0.113.9")

    def request_code(self, email, name=None):
        body = {"email": email} | ({"displayName": name} if name else {})
        return self.api.post("/api/v1/auth/request-code", body, format="json")

    def verify(self, email, code):
        return self.api.post("/api/v1/auth/verify", {"email": email, "code": code}, format="json")

    def code(self):
        return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)

    def test_brute_force_on_one_account_is_aggregated_into_one_alert(self):
        self.request_code("jdoe@example.com", "Jan")
        code = self.code()
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(12):
            self.verify("jdoe@example.com", wrong)
        events = self.sent()
        self.assertEqual([e["rule"]["id"] for e in events], ["puntenteller-api.auth.login-code-bruteforce"])
        alert = events[0]
        self.assertEqual(alert["entities"]["user"], {"name": "jdoe@example.com"})
        self.assertEqual(alert["entities"]["source"], {"ip": "203.0.113.9"})
        self.assertEqual(alert["context"]["failed_attempts"], 10)
        self.assertNotIn(code, json.dumps(events))
        self.assertNotIn(wrong, json.dumps(events))

    def test_login_after_failures_is_high(self):
        self.request_code("jdoe@example.com", "Jan")
        code = self.code()
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(5):
            self.verify("jdoe@example.com", wrong)
        self.request_code("jdoe@example.com")
        self.assertEqual(self.verify("jdoe@example.com", self.code()).status_code, 200)
        events = self.sent()
        self.assertEqual([(e["rule"]["id"], e["severity"]) for e in events],
                         [("puntenteller-api.auth.login-after-failures", "high")])
        self.assertNotIn(self.code(), json.dumps(events))

    def test_normal_login_sends_nothing(self):
        self.request_code("jdoe@example.com", "Jan")
        self.verify("jdoe@example.com", self.code())
        self.assertEqual(self.sent(), [])

    def test_failures_across_accounts_from_one_ip(self):
        for i in range(10):
            self.verify(f"user{i % 3}@example.com", "123456")
        self.assertEqual(self.rule_ids(), ["puntenteller-api.auth.login-failures-from-ip"])
        self.assertEqual(len(self.sent()[0]["context"]["accounts"]), 3)

    def test_code_request_limit(self):
        for _ in range(7):
            self.request_code("jdoe@example.com", "Jan")
        self.assertEqual(self.rule_ids(), ["puntenteller-api.auth.code-request-limit"])

    def test_login_code_volume_across_addresses(self):
        for i in range(50):
            # Elk adres vanaf een eigen IP, zodat de throttle per IP niet ingrijpt.
            self.api.post("/api/v1/auth/request-code", {"email": f"victim{i}@example.com", "displayName": "X"},
                          format="json", REMOTE_ADDR=f"198.51.100.{i}")
        events = self.sent()
        self.assertEqual([e["rule"]["id"] for e in events], ["puntenteller-api.abuse.login-code-volume"])
        self.assertEqual(events[0]["context"]["codes_sent"], 50)
        self.assertEqual(events[0]["context"]["new_accounts"], 50)

    def test_unknown_addresses_on_the_login_form(self):
        for i in range(10):
            self.assertEqual(self.request_code(f"guess{i}@example.com").status_code, 404)
        events = self.sent()
        self.assertEqual([e["rule"]["id"] for e in events], ["puntenteller-api.account.login-enumeration"])
        self.assertNotIn("guess", json.dumps(events))

    def test_same_unknown_address_repeated_is_not_enumeration(self):
        for _ in range(12):
            self.request_code("typo@example.com")
        self.assertEqual(self.sent(), [])

    @mock.patch.object(ReportingScopedRateThrottle, "THROTTLE_RATES", {"auth": "2/hour", "lookup": "30/hour"})
    def test_repeated_throttling(self):
        for _ in range(7):
            self.verify("jdoe@example.com", "123456")
        self.assertIn("puntenteller-api.abuse.rate-limited", self.rule_ids())

    def test_many_distinct_invalid_tokens(self):
        for i in range(12):
            self.api.credentials(HTTP_AUTHORIZATION=f"Bearer forged-{i}")
            self.assertEqual(self.api.get("/api/v1/me").status_code, 401)
        events = self.sent()
        self.assertEqual([e["rule"]["id"] for e in events], ["puntenteller-api.auth.invalid-token-volume"])
        self.assertNotIn("forged-", json.dumps(events))

    def test_one_stale_token_repeated_is_not_an_attack(self):
        self.api.credentials(HTTP_AUTHORIZATION="Bearer stale")
        for _ in range(30):
            self.api.get("/api/v1/me")
        self.assertEqual(self.sent(), [])


@override_settings(**SETTINGS)
class GameDetectionTests(PolarisTestCase, SyncTestCase):
    def test_repeated_forbidden_sync_changes(self):
        self.create_game()
        stranger = Device(make_user("Cas"))
        for i in range(10):
            stranger.sync(scoreEntries=[entry(uid(), self.g, self.p_anna, 100)])
        events = self.sent()
        self.assertEqual([e["rule"]["id"] for e in events], ["puntenteller-api.authz.access-denied-volume"])
        self.assertEqual(events[0]["entities"]["user"], {"name": "cas@example.com"})

    def test_lookup_enumeration(self):
        for i in range(16):
            self.invitee.client.post("/api/v1/accounts/lookup", {"email": f"guess{i}@example.com"}, format="json")
        self.assertEqual(self.rule_ids(), ["puntenteller-api.account.lookup-enumeration"])


@override_settings(**SETTINGS, STORAGES={
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
})
class AdminDetectionTests(PolarisTestCase):
    def login(self, password, ip="203.0.113.7"):
        self.client.post("/admin/login/", {"username": "root@example.com", "password": password}, REMOTE_ADDR=ip)
        return "_auth_user_id" in self.client.session

    def test_admin_brute_force_alerts_and_locks_the_login(self):
        User.objects.create_superuser("root@example.com", "correct horse")
        self.forget()
        for _ in range(10):
            self.assertFalse(self.login("wrong"))
        self.assertFalse(self.login("correct horse"), "dicht, ook met het goede wachtwoord")
        self.assertFalse(self.login("correct horse", ip="198.51.100.1"), "per gebruikersnaam, ook vanaf een ander IP")
        events = self.sent()
        self.assertEqual(sorted(e["rule"]["id"] for e in events), [
            "puntenteller-api.admin.login-bruteforce",  # per gebruikersnaam
            "puntenteller-api.admin.login-bruteforce",  # per IP
        ])
        self.assertNotIn("wrong", json.dumps(events))
        self.assertNotIn("correct horse", json.dumps(events))

    def test_admin_login_after_failures_below_the_lockout(self):
        User.objects.create_superuser("root@example.com", "correct horse")
        self.forget()
        for _ in range(5):
            self.login("wrong")
        self.assertTrue(self.login("correct horse"))
        self.assertEqual(self.rule_ids(), ["puntenteller-api.admin.login-after-failures"])


@override_settings(**SETTINGS)
class PrivilegeAndAssetTests(PolarisTestCase):
    def test_granting_staff_alerts_and_updates_the_asset(self):
        with self.captureOnCommitCallbacks(execute=True):
            user = make_user("Dirk")
        self.assertEqual(self.sent(), [])
        with self.captureOnCommitCallbacks(execute=True):
            user.is_staff = True
            user.save()
        self.assertEqual(self.rule_ids(), ["puntenteller-api.authz.privilege-granted"])
        self.assertEqual(self.sent("assets"), [{"name": "Dirk", "email": "dirk@example.com",
                                                "object_id": str(user.pk), "is_privileged": True}])

    def test_demotion_and_deletion_are_sent_as_not_privileged(self):
        with self.captureOnCommitCallbacks(execute=True):
            admin = User.objects.create_superuser("root@example.com", "pw")
        self.forget()
        with self.captureOnCommitCallbacks(execute=True):
            admin.is_superuser = admin.is_staff = False
            admin.save()
        self.assertEqual([a["is_privileged"] for a in self.sent("assets")], [False])
        self.assertEqual(self.sent(), [], "minder rechten is geen alert")

        with self.captureOnCommitCallbacks(execute=True):
            other = User.objects.create_superuser("ops@example.com", "pw")
        self.forget()
        other_id = str(other.pk)
        with self.captureOnCommitCallbacks(execute=True):
            other.delete()
        self.assertEqual(self.sent("assets"), [{"name": "Beheerder", "email": "ops@example.com",
                                                "object_id": other_id, "is_privileged": False}])

    def test_routine_saves_do_not_query_or_send(self):
        user = make_user("Eva")
        self.forget()
        with self.assertNumQueries(1), self.captureOnCommitCallbacks(execute=True):
            user.is_verified = True
            user.save(update_fields=["is_verified"])
        self.assertEqual(self.requests, [])

    def test_snapshot_has_host_and_only_active_admins(self):
        User.objects.create_superuser("root@example.com", "pw")
        User.objects.create_user("staff@example.com", "Staf", is_staff=True)
        User.objects.create_user("gone@example.com", "Weg", is_staff=True, is_active=False)
        make_user("Speler")
        items = snapshot()
        self.assertEqual(items[0], {"name": "k8s-node-01", "role": "server", "ip_address": "10.0.4.21"})
        self.assertEqual([i.get("email") for i in items[1:]], ["root@example.com", "staff@example.com"])
        self.assertTrue(all(i["is_privileged"] for i in items[1:]))
        for host in items[:1]:
            self.assertFalse({"email", "upn", "domain_account", "username", "object_id"} & host.keys())

    def test_sync_assets_command(self):
        User.objects.create_superuser("root@example.com", "pw")
        self.forget()
        call_command("polaris_sync_assets", stdout=io.StringIO())
        self.assertEqual([a["name"] for a in self.sent("assets")], ["k8s-node-01", "Beheerder"])
