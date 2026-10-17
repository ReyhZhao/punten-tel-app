"""
Eén synthetische alert per rule.id, met `"environment": "test"`, zodat de
SOC voorbeelden heeft om de mapping tegen te bouwen en te controleren.

    python manage.py polaris_test_events            # versturen naar POLARIS_ALERT_INGEST_URL
    python manage.py polaris_test_events --dry-run  # alleen de JSON tonen
"""

import json

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from polaris import client
from polaris.detections import RULES

TEST_USER = "polaris-test@example.com"
TEST_IP = "203.0.113.10"  # TEST-NET-3 (RFC 5737)


def test_alerts() -> list[dict]:
    alerts = []
    for rule in RULES:
        ents = client.entities(user=TEST_USER, ip=TEST_IP)
        alerts.append(client.make_alert(
            rule,
            f"[TEST] {rule.name}",
            f"Synthetic test event for {rule.id}, sent with `manage.py polaris_test_events`. "
            f"Fires in production when: {rule.when}. No action needed.",
            ents,
            context={"synthetic": True, "threshold": rule.threshold, "window_minutes": rule.window // 60},
            environment="test",
        ))
    return alerts


class Command(BaseCommand):
    help = "Stuurt één synthetische test-alert per detectie naar Polaris."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Alleen de payload tonen, niets versturen.")

    def handle(self, *args, dry_run=False, **options):
        alerts = test_alerts()
        if dry_run:
            self.stdout.write(json.dumps({"events": alerts}, indent=2, ensure_ascii=False))
            return
        if not settings.POLARIS_ALERT_INGEST_URL:
            raise CommandError("POLARIS_ALERT_INGEST_URL is niet gezet.")
        sender = client.sender("events")
        if sender is None:
            raise CommandError("POLARIS_ALERT_INGEST_URL wordt niet gebruikt (alleen https is toegestaan).")
        if sender.deliver(alerts):
            raise CommandError(f"Polaris ({sender.label}) was niet bereikbaar; probeer het later opnieuw.")
        if not sender.captured:
            raise CommandError(f"Polaris ({sender.label}) weigerde de test-events; zie de log hierboven.")
        self.stdout.write(self.style.SUCCESS(
            f"{len(alerts)} test-alerts ontvangen door Polaris ({sender.label}), "
            f"captured_payload={sender.captured[-1]}"
        ))
