from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PushDevice


class DeviceSerializer(serializers.Serializer):
    token = serializers.RegexField(r"^[0-9a-fA-F]{32,200}$")
    environment = serializers.ChoiceField(choices=PushDevice.Environment.choices, default="production")


class DevicesView(APIView):
    """Toestel aanmelden voor pushmeldingen (of het token bijwerken)."""

    def post(self, request):
        data = DeviceSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        PushDevice.objects.update_or_create(
            token=data.validated_data["token"].lower(),
            defaults={
                "user": request.user,
                "auth_token": request.auth,
                "environment": data.validated_data["environment"],
            },
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeviceView(APIView):
    """Toestel afmelden (bv. als de gebruiker meldingen uitzet)."""

    def delete(self, request, token):
        get_object_or_404(PushDevice, token=token.lower(), user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
