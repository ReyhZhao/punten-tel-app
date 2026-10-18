from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = "accounts"
    verbose_name = "Accounts"

    def ready(self):
        from . import backends  # noqa: F401  (telt mislukte admin-logins)
