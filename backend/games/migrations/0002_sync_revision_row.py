from django.db import migrations


def create_row(apps, schema_editor):
    apps.get_model("games", "SyncRevision").objects.get_or_create(pk=1, defaults={"value": 0})


class Migration(migrations.Migration):
    """De revisieteller is één rij; die moet bestaan voor de eerste sync."""

    dependencies = [("games", "0001_initial")]
    operations = [migrations.RunPython(create_row, migrations.RunPython.noop)]
