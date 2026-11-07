from django.contrib import admin
from django.template.response import TemplateResponse

from . import stats


def statistics(request):
    """Beheerdersdashboard; via admin.site.admin_view alleen voor ingelogde staff."""
    context = admin.site.each_context(request) | {"title": "Statistieken", "stats": stats.collect()}
    return TemplateResponse(request, "admin/dashboard/statistics.html", context)
