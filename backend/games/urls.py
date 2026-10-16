from django.urls import path

from . import events, views

urlpatterns = [
    path("sync", views.SyncView.as_view()),
    path("events", events.events),
    path("accounts/lookup", views.AccountLookupView.as_view()),
    path("games/<uuid:game_id>/leave", views.LeaveGameView.as_view()),
    path("games/<uuid:game_id>/transfer", views.TransferGameView.as_view()),
]
