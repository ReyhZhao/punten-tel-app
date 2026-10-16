"""
Accounts zonder wachtwoord: een gebruiker meldt zich aan met e-mailadres en
schermnaam en bevestigt met een 6-cijferige code uit de e-mail. Dezelfde flow
is ook het inloggen op een nieuw toestel. Elk toestel krijgt een eigen token.

Codes en tokens worden alleen als hash opgeslagen.
"""

import hashlib
import hmac
import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


def normalize_email(email: str) -> str:
    return email.strip().lower()


class UserManager(BaseUserManager):
    def create_user(self, email: str, display_name: str, **extra):
        user = self.model(email=normalize_email(email), display_name=display_name.strip(), **extra)
        user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str, display_name: str = "Beheerder", **extra):
        """Alleen voor de Django-admin; app-gebruikers hebben geen wachtwoord."""
        user = self.model(
            email=normalize_email(email), display_name=display_name,
            is_staff=True, is_superuser=True, is_verified=True, **extra,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField("e-mailadres", unique=True)
    display_name = models.CharField("schermnaam", max_length=40)
    is_verified = models.BooleanField("e-mail bevestigd", default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["display_name"]

    class Meta:
        verbose_name = "account"
        verbose_name_plural = "accounts"

    def __str__(self) -> str:
        return f"{self.display_name} <{self.email}>"


def _digest(value: str) -> str:
    """HMAC met de SECRET_KEY, zodat een gelekte database geen bruikbare hashes geeft."""
    return hmac.new(settings.SECRET_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()


class LoginCode(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="login_codes")
    code_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)

    @classmethod
    def issue(cls, user: User) -> str:
        """Maakt een nieuwe code; eerdere ongebruikte codes vervallen."""
        cls.objects.filter(user=user, used_at__isnull=True).delete()
        code = f"{secrets.randbelow(1_000_000):06d}"
        cls.objects.create(
            user=user,
            code_hash=_digest(f"{user.pk}:{code}"),
            expires_at=timezone.now() + timedelta(minutes=settings.LOGIN_CODE_TTL_MINUTES),
        )
        return code

    def matches(self, code: str) -> bool:
        return hmac.compare_digest(self.code_hash, _digest(f"{self.user_id}:{code.strip()}"))

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at


class AuthToken(models.Model):
    """Token per toestel. De app stuurt `Authorization: Bearer <token>`."""

    key_hash = models.CharField(max_length=64, unique=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tokens")
    device_name = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    @classmethod
    def create_for(cls, user: User, device_name: str = "") -> tuple["AuthToken", str]:
        key = secrets.token_urlsafe(32)
        token = cls.objects.create(user=user, key_hash=_digest(key), device_name=device_name[:80])
        return token, key

    @classmethod
    def lookup(cls, key: str) -> "AuthToken | None":
        return cls.objects.select_related("user").filter(key_hash=_digest(key)).first()
