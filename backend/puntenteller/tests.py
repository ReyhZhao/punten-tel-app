from django.test import TestCase, override_settings


class HealthTests(TestCase):
    @override_settings(ALLOWED_HOSTS=["punten.vels.online"])
    def test_health_ignores_host_header(self):
        # Kubernetes-probes sturen het IP van de pod als Host.
        r = self.client.get("/healthz", HTTP_HOST="10.42.0.17:8000")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"status": "ok"})

    @override_settings(ALLOWED_HOSTS=["punten.vels.online"])
    def test_other_paths_still_check_host(self):
        self.assertEqual(self.client.get("/api/v1/me", HTTP_HOST="evil.example").status_code, 400)
