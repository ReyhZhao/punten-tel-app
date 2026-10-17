"""
De asset-snapshot (host + beheerders) nu versturen, in plaats van op de
dagelijkse ronde van de achtergrond-thread te wachten. Draai dit in de pod
(`kubectl exec deploy/punten-api -- python manage.py polaris_sync_assets`),
niet lokaal: daar is de database niet die van productie.

    python manage.py polaris_sync_assets --dry-run  # alleen de JSON tonen
"""

import json

from django.core.management.base import BaseCommand, CommandError

from polaris import client
from polaris.assets import snapshot


class Command(BaseCommand):
    help = "Stuurt de asset-snapshot (host en beheerders) naar Polaris."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Alleen de payload tonen, niets versturen.")

    def handle(self, *args, dry_run=False, **options):
        assets = snapshot()
        if dry_run:
            self.stdout.write(json.dumps({"assets": assets}, indent=2, ensure_ascii=False))
            return
        sender = client.sender("assets")
        if sender is None:
            raise CommandError("POLARIS_ASSET_INGEST_URL is niet gezet (of geen https).")
        if not assets:
            self.stdout.write("Niets te versturen: geen POLARIS_HOST_NAME en geen beheerders.")
            return
        if sender.deliver(assets):
            raise CommandError(f"Polaris ({sender.label}) was niet bereikbaar; probeer het later opnieuw.")
        if not sender.captured:
            raise CommandError(f"Polaris ({sender.label}) weigerde de snapshot; zie de log hierboven.")
        self.stdout.write(self.style.SUCCESS(
            f"{len(assets)} asset(s) ontvangen door Polaris ({sender.label}), captured_payload={sender.captured[-1]}"
        ))
