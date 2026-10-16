from django.contrib import admin

from .models import Game, GameProfile, Player, ScoreEntry


class PlayerInline(admin.TabularInline):
    model = Player
    extra = 0
    fields = ["position", "name", "color", "account"]
    readonly_fields = fields


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ["name", "owner", "updated_at", "finished_at", "deleted_at", "participants_can_score"]
    list_filter = ["participants_can_score"]
    search_fields = ["name", "owner__email"]
    inlines = [PlayerInline]
    readonly_fields = ["id", "revision"]


@admin.register(GameProfile)
class GameProfileAdmin(admin.ModelAdmin):
    list_display = ["name", "owner", "updated_at", "deleted_at"]
    search_fields = ["name", "owner__email"]
    readonly_fields = ["id", "revision"]


@admin.register(ScoreEntry)
class ScoreEntryAdmin(admin.ModelAdmin):
    list_display = ["game", "player", "delta", "created_at", "undone_at", "created_by"]
    readonly_fields = ["id", "revision"]
