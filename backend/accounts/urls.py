from django.urls import path

from . import views

urlpatterns = [
    path("auth/request-code", views.RequestCodeView.as_view()),
    path("auth/verify", views.VerifyCodeView.as_view()),
    path("auth/logout", views.LogoutView.as_view()),
    path("me", views.MeView.as_view()),
    path("me/invite-code", views.InviteCodeView.as_view()),
]
