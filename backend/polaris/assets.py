"""
Inventaris voor Polaris: de host waarop de backend draait en de accounts die
ertoe doen. Dat zijn alleen de beheerders (is_staff/is_superuser). Gewone
spelers sturen we niet; de app is wel zelf de identiteitsbron (geen SCIM).

Polaris kent geen verwijderen. Een beheerder die zijn rechten verliest, wordt
uitgeschakeld of verwijderd, sturen we daarom nog één keer met
`is_privileged: false` (zie polaris.signals).
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q

from . import client


def is_privileged(user) -> bool:
    return bool(user.is_active and (user.is_staff or user.is_superuser))


def host_asset() -> dict | None:
    """De Kubernetes-node (downward API), niet de pod: podnamen wisselen bij elke uitrol."""
    if not settings.POLARIS_HOST_NAME:
        return None
    asset = {"name": settings.POLARIS_HOST_NAME, "role": "server"}
    if settings.POLARIS_HOST_IP and (ip := client.valid_ip(settings.POLARIS_HOST_IP)):
        asset["ip_address"] = ip
    return asset


def user_asset(user, privileged: bool | None = None) -> dict:
    return {
        "name": user.display_name,
        "email": user.email,
        "object_id": str(user.pk),
        "is_privileged": is_privileged(user) if privileged is None else privileged,
    }


def snapshot() -> list[dict]:
    admins = get_user_model().objects.filter(is_active=True).filter(Q(is_staff=True) | Q(is_superuser=True))
    host = host_asset()
    return ([host] if host else []) + [user_asset(u, True) for u in admins.order_by("email")]


def queue_snapshot() -> int:
    s = client.sender("assets")
    if s is None:
        return 0
    items = snapshot()
    for item in items:
        s.enqueue(item)
    return len(items)
