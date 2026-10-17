from django.conf import settings
from django.db import models


class PushDevice(models.Model):
    """
    Een iOS-toestel dat pushmeldingen wil ontvangen. Gekoppeld aan het
    login-token van dat toestel: bij uitloggen verdwijnt het token en daarmee
    deze registratie, zodat er geen meldingen meer naar een uitgelogd toestel
    gaan.
    """

    class Environment(models.TextChoices):
        SANDBOX = "sandbox", "Sandbox (ontwikkeling)"
        PRODUCTION = "production", "Productie (TestFlight/App Store)"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_devices")
    auth_token = models.ForeignKey("accounts.AuthToken", on_delete=models.CASCADE, related_name="push_devices")
    token = models.CharField(max_length=200, unique=True)
    environment = models.CharField(max_length=12, choices=Environment.choices, default=Environment.PRODUCTION)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "pushtoestel"
        verbose_name_plural = "pushtoestellen"

    def __str__(self) -> str:
        return f"{self.user} ({self.environment})"
