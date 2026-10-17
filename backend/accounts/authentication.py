from datetime import timedelta

from django.utils import timezone
from rest_framework import authentication, exceptions

from polaris import detections

from .models import AuthToken


class BearerTokenAuthentication(authentication.BaseAuthentication):
    """`Authorization: Bearer <token>` met een token uit `AuthToken`."""

    keyword = "Bearer"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode()
        if not header.startswith(f"{self.keyword} "):
            return None
        key = header[len(self.keyword) + 1 :].strip()
        token = AuthToken.lookup(key)
        if token is None or not token.user.is_active:
            detections.invalid_token(request, key)
            raise exceptions.AuthenticationFailed("Ongeldig of verlopen token.")
        # Niet bij elk verzoek schrijven; eens per uur is genoeg.
        now = timezone.now()
        if token.last_used_at is None or now - token.last_used_at > timedelta(hours=1):
            AuthToken.objects.filter(pk=token.pk).update(last_used_at=now)
        return token.user, token

    def authenticate_header(self, request):
        return self.keyword
