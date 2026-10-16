import re
from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import AuthToken, LoginCode, User


def code_from_mail() -> str:
    return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)


class AuthFlowTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def request_code(self, email, name=None):
        body = {"email": email} | ({"displayName": name} if name else {})
        return self.client.post("/api/v1/auth/request-code", body, format="json")

    def verify(self, email, code):
        return self.client.post("/api/v1/auth/verify", {"email": email, "code": code, "deviceName": "iPhone"}, format="json")

    def test_signup_and_verify(self):
        r = self.request_code("Anna@Example.com ", "Anna")
        self.assertEqual(r.status_code, 202)
        self.assertTrue(r.json()["newAccount"])
        self.assertEqual(mail.outbox[-1].to, ["anna@example.com"])
        self.assertIn("Hoi Anna", mail.outbox[-1].body)

        r = self.verify("anna@example.com", code_from_mail())
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["account"]["displayName"], "Anna")
        self.assertTrue(User.objects.get(email="anna@example.com").is_verified)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['token']}")
        self.assertEqual(self.client.get("/api/v1/me").json()["email"], "anna@example.com")

    def test_unknown_email_without_name_asks_for_signup(self):
        r = self.request_code("nieuw@example.com")
        self.assertEqual(r.status_code, 404)
        self.assertEqual(r.json()["code"], "account_not_found")
        self.assertEqual(len(mail.outbox), 0)

    def test_login_on_second_device_needs_only_email(self):
        self.request_code("bram@example.com", "Bram")
        self.verify("bram@example.com", code_from_mail())
        r = self.request_code("bram@example.com")
        self.assertEqual(r.status_code, 202)
        self.assertFalse(r.json()["newAccount"])
        self.assertEqual(self.verify("bram@example.com", code_from_mail()).status_code, 200)
        self.assertEqual(AuthToken.objects.filter(user__email="bram@example.com").count(), 2)

    def test_code_is_single_use(self):
        self.request_code("cas@example.com", "Cas")
        code = code_from_mail()
        self.assertEqual(self.verify("cas@example.com", code).status_code, 200)
        self.assertEqual(self.verify("cas@example.com", code).json()["code"], "invalid_code")

    def test_new_code_invalidates_previous(self):
        self.request_code("dirk@example.com", "Dirk")
        old = code_from_mail()
        self.request_code("dirk@example.com")
        new = code_from_mail()
        if old != new:
            self.assertEqual(self.verify("dirk@example.com", old).status_code, 400)
        self.assertEqual(self.verify("dirk@example.com", new).status_code, 200)

    def test_too_many_wrong_attempts(self):
        self.request_code("eva@example.com", "Eva")
        code = code_from_mail()
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(5):
            self.assertEqual(self.verify("eva@example.com", wrong).json()["code"], "invalid_code")
        self.assertEqual(self.verify("eva@example.com", code).json()["code"], "too_many_attempts")

    def test_expired_code(self):
        self.request_code("fleur@example.com", "Fleur")
        LoginCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.verify("fleur@example.com", code_from_mail()).json()["code"], "code_expired")

    def test_codes_per_email_are_limited(self):
        for _ in range(5):
            self.assertEqual(self.request_code("gijs@example.com", "Gijs").status_code, 202)
        self.assertEqual(self.request_code("gijs@example.com").status_code, 429)

    def test_codes_are_not_stored_in_plain_text(self):
        self.request_code("hans@example.com", "Hans")
        self.assertNotIn(code_from_mail(), LoginCode.objects.get().code_hash)


class AccountTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user("ivo@example.com", "Ivo", is_verified=True)
        _, key = AuthToken.create_for(self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {key}")

    def test_requires_token(self):
        self.assertEqual(APIClient().get("/api/v1/me").status_code, 401)
        bad = APIClient()
        bad.credentials(HTTP_AUTHORIZATION="Bearer onzin")
        self.assertEqual(bad.get("/api/v1/me").status_code, 401)

    def test_change_display_name(self):
        r = self.client.patch("/api/v1/me", {"displayName": " Ivo V. "}, format="json")
        self.assertEqual(r.json()["displayName"], "Ivo V.")
        self.assertEqual(self.client.patch("/api/v1/me", {"displayName": " "}, format="json").status_code, 400)

    def test_email_cannot_be_changed(self):
        self.client.patch("/api/v1/me", {"email": "ander@example.com"}, format="json")
        self.assertEqual(User.objects.get(pk=self.user.pk).email, "ivo@example.com")

    def test_logout_invalidates_token(self):
        self.assertEqual(self.client.post("/api/v1/auth/logout").status_code, 204)
        self.assertEqual(self.client.get("/api/v1/me").status_code, 401)

    def test_delete_account(self):
        self.assertEqual(self.client.delete("/api/v1/me").status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())
