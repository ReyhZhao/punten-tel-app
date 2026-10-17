"""
Instellingen voor de Puntenteller-backend.

Alles komt uit omgevingsvariabelen, zodat dezelfde image lokaal, in CI en in
productie draait. Zonder POSTGRES_HOST wordt SQLite gebruikt (handig lokaal).
Zie backend/README.md voor alle variabelen.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def env(name: str, default: str | None = None) -> str | None:
    return os.environ.get(name, default)


def env_bool(name: str, default: bool = False) -> bool:
    return env(name, str(default)).lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [v.strip() for v in env(name, default).split(",") if v.strip()]


DEBUG = env_bool("DJANGO_DEBUG", False)
SECRET_KEY = env("DJANGO_SECRET_KEY") or ("dev-only-insecure-key" if DEBUG else None)
if not SECRET_KEY:
    raise RuntimeError("DJANGO_SECRET_KEY is verplicht als DJANGO_DEBUG uit staat")

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1" if DEBUG else "")
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "accounts",
    "games",
    "notifications",
]

MIDDLEWARE = [
    "puntenteller.health.HealthCheckMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "puntenteller.urls"
WSGI_APPLICATION = "puntenteller.wsgi.application"
ASGI_APPLICATION = "puntenteller.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

if env("POSTGRES_HOST"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "HOST": env("POSTGRES_HOST"),
            "PORT": env("POSTGRES_PORT", "5432"),
            "NAME": env("POSTGRES_DB", "puntenteller"),
            "USER": env("POSTGRES_USER", "puntenteller"),
            "PASSWORD": env("POSTGRES_PASSWORD", ""),
            # Onder ASGI draaien synchrone views in een threadpool; persistente
            # verbindingen per thread stapelen zich dan op. Daarom per verzoek.
            "CONN_MAX_AGE": 0,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LANGUAGE_CODE = "nl"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Onder /api/, zodat de ingress alleen /api/ en /admin/ naar de backend hoeft
# te sturen en niets botst met de PWA op hetzelfde domein. WhiteNoise serveert ze.
STATIC_URL = "/api/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# Cache voor rate limiting. Lokaal in het geheugen; met meerdere replicas
# moet dit een gedeelde cache worden (bv. Redis), zie README.
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["accounts.authentication.BearerTokenAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_CLASSES": [],
    "DEFAULT_THROTTLE_RATES": {
        "lookup": env("THROTTLE_LOOKUP", "30/hour"),
        "auth": env("THROTTLE_AUTH", "20/hour"),
    },
    "EXCEPTION_HANDLER": "rest_framework.views.exception_handler",
    "UNAUTHENTICATED_USER": None,
}

# E-mail (bevestigingscodes). Lokaal naar de console, in productie SMTP.
EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend" if DEBUG else "django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_HOST = env("EMAIL_HOST", "localhost")
EMAIL_PORT = int(env("EMAIL_PORT", "587"))
EMAIL_HOST_USER = env("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_TIMEOUT = 10
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "Puntenteller <noreply@vels.online>")

# Pushmeldingen via Apple (APNs). Zonder sleutel staat push uit.
APNS_KEY_ID = env("APNS_KEY_ID", "")
APNS_TEAM_ID = env("APNS_TEAM_ID", "")
APNS_PRIVATE_KEY = env("APNS_PRIVATE_KEY", "")  # inhoud van de .p8-sleutel
APNS_TOPIC = env("APNS_TOPIC", "online.vels.puntenteller")
PUSH_ASYNC = True  # in een achtergrond-thread versturen (tests: synchroon)

# Inlogcodes
LOGIN_CODE_TTL_MINUTES = int(env("LOGIN_CODE_TTL_MINUTES", "15"))
LOGIN_CODE_MAX_ATTEMPTS = 5

# Account voor Apple's app-review: reviewers kunnen geen e-mail ontvangen, dus
# voor dit ene adres geldt een vaste code (uit Vault) en wordt niets gemaild.
# Leeg = uit.
REVIEW_ACCOUNT_EMAIL = (env("REVIEW_ACCOUNT_EMAIL", "") or "").strip().lower()
REVIEW_ACCOUNT_CODE = (env("REVIEW_ACCOUNT_CODE", "") or "").strip()

# Achter een reverse proxy (ingress) die TLS afhandelt.
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", "INFO")},
}
