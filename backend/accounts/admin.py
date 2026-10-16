from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import AuthToken, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["email"]
    list_display = ["email", "display_name", "is_verified", "is_active", "date_joined"]
    list_filter = ["is_verified", "is_active", "is_staff"]
    search_fields = ["email", "display_name"]
    fieldsets = [
        (None, {"fields": ["email", "display_name", "password"]}),
        ("Status", {"fields": ["is_verified", "is_active", "is_staff", "is_superuser", "date_joined"]}),
    ]
    add_fieldsets = [(None, {"classes": ["wide"], "fields": ["email", "display_name", "password1", "password2"]})]
    readonly_fields = ["date_joined"]


@admin.register(AuthToken)
class AuthTokenAdmin(admin.ModelAdmin):
    list_display = ["user", "device_name", "created_at", "last_used_at"]
    readonly_fields = ["key_hash", "created_at", "last_used_at"]
