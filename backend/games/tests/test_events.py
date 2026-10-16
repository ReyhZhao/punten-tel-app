import asyncio
from unittest import mock

from django.core.cache import cache
from django.test import TransactionTestCase

from accounts.models import AuthToken, User
from games.events import broker
from games.tests.test_sync import Device, SyncTestCase, entry, player, uid


class EventStreamTests(TransactionTestCase):
    """De SSE-stream zelf (TransactionTestCase: de view leest in een andere thread)."""

    def setUp(self):
        self.user = User.objects.create_user("anna@example.com", "Anna", is_verified=True)
        _, self.token = AuthToken.create_for(self.user)

    async def test_requires_token(self):
        r = await self.async_client.get("/api/v1/events")
        self.assertEqual(r.status_code, 401)

    async def test_stream_sends_change_with_cursor(self):
        r = await self.async_client.get("/api/v1/events", headers={"Authorization": f"Bearer {self.token}"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Content-Type"], "text/event-stream")
        self.assertEqual(r["X-Accel-Buffering"], "no")
        chunks = aiter(r.streaming_content)
        self.assertEqual(await anext(chunks), b"retry: 5000\n\n")
        # Seintje voor dit account (zoals na een sync) komt binnen; voor een ander niet.
        next_chunk = asyncio.ensure_future(anext(chunks))
        await asyncio.sleep(0)
        broker.dispatch(["iemand-anders"], 41)
        broker.dispatch([str(self.user.pk)], 42)
        self.assertEqual(await asyncio.wait_for(next_chunk, 2), b"event: change\ndata: 42\n\n")


class NotifyTargetTests(SyncTestCase):
    """Wie krijgt een seintje na welke wijziging (na de commit)."""

    def setUp(self):
        super().setUp()
        cache.clear()
        patcher = mock.patch("games.sync.notify")
        self.notify = patcher.start()
        self.addCleanup(patcher.stop)

    def users_notified(self, action):
        self.notify.reset_mock()
        with self.captureOnCommitCallbacks(execute=True):
            action()
        return [({str(u) for u in call.args[0]}, call.args[1]) for call in self.notify.call_args_list]

    def test_scoring_notifies_owner_and_participants(self):
        self.create_game(bram_account=str(self.bram.pk))
        calls = self.users_notified(lambda: self.owner.sync(scoreEntries=[entry(uid(), self.g, self.p_anna, 5)]))
        self.assertEqual(len(calls), 1)
        users, cursor = calls[0]
        self.assertEqual(users, {str(self.anna.pk), str(self.bram.pk)})
        self.assertEqual(cursor, self.owner.cursor)

    def test_unlinked_player_is_notified_so_the_game_disappears(self):
        self.create_game(bram_account=str(self.bram.pk))
        calls = self.users_notified(lambda: self.owner.sync(players=[player(self.p_bram, self.g, "Bram", 1, minutes=5)]))
        self.assertIn(str(self.bram.pk), calls[0][0])

    def test_leave_and_transfer_notify_everyone_involved(self):
        self.create_game(bram_account=str(self.bram.pk))
        calls = self.users_notified(
            lambda: self.owner.client.post(f"/api/v1/games/{self.g}/transfer", {"accountId": str(self.bram.pk)}, format="json")
        )
        self.assertEqual(calls[0][0], {str(self.anna.pk), str(self.bram.pk)})
        calls = self.users_notified(lambda: self.owner.client.post(f"/api/v1/games/{self.g}/leave"))
        self.assertEqual(calls[0][0], {str(self.anna.pk), str(self.bram.pk)})

    def test_profile_changes_notify_own_devices(self):
        rules = {"scoring": "high", "timerOn": False, "timerSecs": 60, "endMode": "round", "sortPlayers": True}
        calls = self.users_notified(lambda: self.owner.sync(
            gameProfiles=[{"id": uid(), "name": "Golf", "rules": rules, "updatedAt": "2026-10-16T12:00:00Z"}]
        ))
        self.assertEqual(calls[0][0], {str(self.anna.pk)})

    def test_read_only_sync_sends_nothing(self):
        self.create_game(bram_account=str(self.bram.pk))
        self.assertEqual(self.users_notified(lambda: self.invitee.sync()), [])
