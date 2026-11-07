from django.contrib import admin
from django.urls import include, path

from dashboard.views import statistics

admin.site.index_template = "admin/dashboard/index.html"

# /healthz wordt beantwoord door puntenteller.health.HealthCheckMiddleware.
urlpatterns = [
    path("admin/statistieken/", admin.site.admin_view(statistics), name="admin-statistics"),
    path("admin/", admin.site.urls),
    path("api/v1/", include("accounts.urls")),
    path("api/v1/", include("games.urls")),
    path("api/v1/", include("notifications.urls")),
]
