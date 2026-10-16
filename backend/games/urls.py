from django.urls import path

from . import views

urlpatterns = [
    path("sync", views.SyncView.as_view()),
    path("accounts/lookup", views.AccountLookupView.as_view()),
    path("games/<uuid:game_id>/leave", views.LeaveGameView.as_view()),
    path("games/<uuid:game_id>/transfer", views.TransferGameView.as_view()),
]
