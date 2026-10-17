from django.apps import AppConfig
from django.core.signals import request_started


class PolarisConfig(AppConfig):
    name = "polaris"
    verbose_name = "Polaris Security"

    def ready(self):
        from . import client, signals  # noqa: F401  (signalen registreren)

        # De achtergrond-thread start bij het eerste verzoek, niet bij manage.py-commando's.
        request_started.connect(client.ensure_worker, dispatch_uid="polaris-worker")
