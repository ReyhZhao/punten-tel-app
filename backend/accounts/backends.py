"""
Inloggen met wachtwoord, alleen voor /admin/ (app-gebruikers hebben er geen).
Na te veel mislukte pogingen voor een gebruikersnaam of vanaf een IP gaat het
inloggen voor de rest van het venster dicht, ook met het goede wachtwoord.
Polaris krijgt dezelfde mislukkingen als alert (polaris.signals).
"""

from django.conf import settings
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.signals import user_login_failed
from django.core.cache import cache
from django.core.exceptions import PermissionDenied
from django.dispatch import receiver

from polaris.detections import client_ip


def _keys(request, username) -> list[str]:
    keys = []
    if username := str(username or "").strip().lower():
        keys.append(f"admin-login-failures:user:{username}")
    if ip := client_ip(request):
        keys.append(f"admin-login-failures:ip:{ip}")
    return keys


def is_locked(request, username) -> bool:
    return any(cache.get(k, 0) >= settings.ADMIN_LOGIN_MAX_FAILURES for k in _keys(request, username))


class LockoutModelBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        if is_locked(request, username):
            # PermissionDenied: Django stopt en stuurt user_login_failed (telt ook voor Polaris).
            raise PermissionDenied
        return super().authenticate(request, username=username, password=password, **kwargs)


@receiver(user_login_failed)
def count_failure(sender, credentials, request=None, **kwargs):
    for key in _keys(request, credentials.get("username")):
        cache.add(key, 0, timeout=settings.ADMIN_LOGIN_LOCKOUT_SECONDS)
        try:
            cache.incr(key)
        except ValueError:  # net verlopen
            cache.set(key, 1, timeout=settings.ADMIN_LOGIN_LOCKOUT_SECONDS)
