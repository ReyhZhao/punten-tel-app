from django.contrib import admin
from django.urls import include, path

# /healthz wordt beantwoord door puntenteller.health.HealthCheckMiddleware.
urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("accounts.urls")),
    path("api/v1/", include("games.urls")),
]
