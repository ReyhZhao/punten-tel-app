from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from polaris.throttling import ReportingScopedRateThrottle

from .models import PushDevice

# Meer toestellen per account is geen echt gebruik; de oudste vallen af.
MAX_DEVICES_PER_USER = 20


class DeviceSerializer(serializers.Serializer):
    token = serializers.RegexField(r"^[0-9a-fA-F]{32,200}$")
    environment = serializers.ChoiceField(choices=PushDevice.Environment.choices, default="production")


class DevicesView(APIView):
    """Toestel aanmelden voor pushmeldingen (of het token bijwerken)."""

    throttle_classes = [ReportingScopedRateThrottle]
    throttle_scope = "push"

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
        keep = PushDevice.objects.filter(user=request.user).order_by("-updated_at")[:MAX_DEVICES_PER_USER]
        PushDevice.objects.filter(user=request.user).exclude(pk__in=list(keep.values_list("pk", flat=True))).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeviceView(APIView):
    """Toestel afmelden (bv. als de gebruiker meldingen uitzet)."""

    def delete(self, request, token):
        get_object_or_404(PushDevice, token=token.lower(), user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
