from django.urls import path

from . import views

urlpatterns = [
    path("push/devices", views.DevicesView.as_view()),
    path("push/devices/<str:token>", views.DeviceView.as_view()),
]
