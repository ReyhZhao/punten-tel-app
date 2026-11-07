import uuid
from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import AuthToken, User
from dashboard import stats
from games.models import Game, Player, ScoreEntry


def game(owner, *, created=None, finished=False, deleted=False):
    now = timezone.now()
    return Game.objects.create(
        id=uuid.uuid4(), owner=owner, name="Klaverjassen", rules={}, revision=1,
        created_at=created or now, updated_at=created or now,
        finished_at=now if finished else None, deleted_at=now if deleted else None,
    )


def player(g, name, account=None):
    return Player.objects.create(id=uuid.uuid4(), game=g, name=name, color="#000000",
                                 account=account, updated_at=timezone.now(), revision=1)


class StatsTests(TestCase):
    def setUp(self):
        self.anna = User.objects.create_user("anna@example.com", "Anna", is_verified=True)
        self.bram = User.objects.create_user("bram@example.com", "Bram")
        old = User.objects.create_user("oud@example.com", "Oud")
        User.objects.filter(pk=old.pk).update(date_joined=timezone.now() - timedelta(days=60))
        User.objects.create_superuser("admin@example.com", "geheim-wachtwoord")

        token, _ = AuthToken.create_for(self.anna)
        AuthToken.objects.filter(pk=token.pk).update(last_used_at=timezone.now())

        g1 = game(self.anna)
        p1 = player(g1, "Anna", self.anna)
        player(g1, "Bram", self.bram)
        player(g1, "Gast")
        ScoreEntry.objects.create(id=uuid.uuid4(), game=g1, player=p1, delta=10,
                                  created_at=timezone.now(), revision=1)
        g2 = game(self.anna, finished=True)
        player(g2, "Anna", self.anna)
        game(self.bram, deleted=True)

    def test_counts(self):
        s = stats.collect()
        self.assertEqual(s["accounts"]["total"], 3)  # beheerder telt niet mee
        self.assertEqual(s["accounts"]["admins"], 1)
        self.assertEqual(s["accounts"]["new_7d"], 2)
        self.assertEqual(s["accounts"]["active_7d"], 1)
        self.assertEqual(s["games"]["total"], 2)
        self.assertEqual(s["games"]["finished"], 1)
        self.assertEqual(s["games"]["deleted"], 1)
        self.assertEqual(s["games"]["shared"], 1)  # alleen g1 heeft een ander account
        self.assertEqual(s["seats"]["total"], 4)
        self.assertEqual(s["seats"]["avg_per_game"], 2.0)
        self.assertEqual(s["scoring"]["total"], 1)
        self.assertEqual({b["label"]: b["value"] for b in s["size_dist"]}["3"], 1)
        for _, weeks in s["weekly"]:
            self.assertEqual(len(weeks), stats.WEEKS + 1)
        self.assertEqual(s["weekly"][1][1][-1].value, 3)  # nieuwe spellen deze week, ook verwijderd


# Zonder collectstatic is er geen manifest; voor het renderen van admin-pagina's volstaat de gewone opslag.
@override_settings(STORAGES={
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
})
class StatsPageTests(TestCase):
    def test_requires_staff(self):
        r = self.client.get("/admin/statistieken/")
        self.assertEqual(r.status_code, 302)
        self.assertIn("/admin/login/", r["Location"])

        User.objects.create_user("speler@example.com", "Speler")
        self.client.force_login(User.objects.get(email="speler@example.com"))
        self.assertEqual(self.client.get("/admin/statistieken/").status_code, 302)

    def test_renders_for_admin_without_personal_data(self):
        User.objects.create_user("anna@example.com", "Anna")
        admin = User.objects.create_superuser("admin@example.com", "geheim-wachtwoord")
        self.client.force_login(admin)
        r = self.client.get("/admin/statistieken/")
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Spelers per spel")
        self.assertNotContains(r, "anna@example.com")
        self.assertContains(self.client.get("/admin/"), "/admin/statistieken/")
