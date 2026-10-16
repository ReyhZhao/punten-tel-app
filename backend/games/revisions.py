from django.db import transaction

from .models import SyncRevision


def current_revision() -> int:
    return SyncRevision.objects.filter(pk=1).values_list("value", flat=True).first() or 0


class RevisionAllocator:
    """
    Geeft binnen één transactie één nieuwe revisie uit, pas als er echt iets
    geschreven wordt. De rij-lock houdt schrijvende transacties op volgorde,
    zodat een revisie nooit later zichtbaar wordt dan een hogere (anders zou
    een client met die hogere cursor hem missen).
    """

    def __init__(self) -> None:
        self._value: int | None = None

    def get(self) -> int:
        if self._value is None:
            assert transaction.get_connection().in_atomic_block, "revisie alleen binnen een transactie"
            row = SyncRevision.objects.select_for_update().get(pk=1)
            row.value += 1
            row.save(update_fields=["value"])
            self._value = row.value
        return self._value

    @property
    def used(self) -> int | None:
        return self._value
