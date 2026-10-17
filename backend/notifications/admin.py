from django.contrib import admin

from .models import PushDevice


@admin.register(PushDevice)
class PushDeviceAdmin(admin.ModelAdmin):
    list_display = ["user", "environment", "created_at", "updated_at"]
    list_filter = ["environment"]
    search_fields = ["user__email"]
    readonly_fields = ["token", "created_at", "updated_at"]
