"""
De tabel voor de gedeelde cache (settings.CACHES: rate limiting, code-limieten,
Polaris-tellers). Via een migratie, zodat de bestaande initContainer
(`migrate`) hem aanmaakt; createcachetable slaat een bestaande tabel over.
"""

from django.core.management import call_command
from django.db import migrations


def create_cache_table(apps, schema_editor):
    call_command("createcachetable", database=schema_editor.connection.alias, verbosity=0)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_invite_code'),
    ]

    operations = [
        migrations.RunPython(create_cache_table, migrations.RunPython.noop),
    ]
