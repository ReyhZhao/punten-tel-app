from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import InviteCode, normalize_email
from polaris import detections
from polaris.throttling import ReportingScopedRateThrottle

from . import sync as sync_service
from .access import visible_games
from .serializers import SyncRequestSerializer

User = get_user_model()


class SyncView(APIView):
    throttle_classes = [ReportingScopedRateThrottle]
    throttle_scope = "sync"

    def post(self, request):
        data = SyncRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        result = sync_service.sync(
            request.user, data.validated_data.get("cursor"), data.validated_data.get("changes") or {}
        )
        if forbidden := sum(r.reason == "forbidden" for r in result.rejected):
            detections.access_denied(request, forbidden, "sync")
        return Response(result.as_dict())


class LookupSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)
    code = serializers.RegexField(r"^\s*\d{6}\s*$", required=False)

    def validate(self, attrs):
        if ("email" in attrs) == ("code" in attrs):
            raise serializers.ValidationError("Geef een e-mailadres of een code.")
        return attrs


class AccountLookupView(APIView):
    """
    Speler zoeken om uit te nodigen: op het volledige e-mailadres of op de
    uitnodigcode die de speler op zijn scherm toont, en alleen bevestigde
    accounts. Geeft id en schermnaam, nooit het e-mailadres van anderen terug.
    Begrensd per gebruiker tegen het raden van adressen en codes.
    """

    throttle_classes = [ReportingScopedRateThrottle]
    throttle_scope = "lookup"

    def post(self, request):
        data = LookupSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        if "code" in data.validated_data:
            user = InviteCode.find_user(data.validated_data["code"])
            if user is None:
                detections.lookup_missed(request, "invite_code")
                return Response(
                    {"code": "invite_code_not_found", "detail": "Deze code klopt niet of is verlopen."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            user = User.objects.filter(
                email=normalize_email(data.validated_data["email"]), is_verified=True, is_active=True
            ).first()
            if user is None:
                detections.lookup_missed(request, "email")
                return Response(
                    {"code": "account_not_found", "detail": "Er is geen account met dit e-mailadres."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        return Response({"id": str(user.pk), "displayName": user.display_name})


class TransferSerializer(serializers.Serializer):
    accountId = serializers.UUIDField()
    ownerPlayerId = serializers.UUIDField(required=False, allow_null=True)


class TransferGameView(APIView):
    """Eigenaar overdragen aan een uitgenodigde speler."""

    def post(self, request, game_id):
        game = get_object_or_404(visible_games(request.user), pk=game_id)
        data = TransferSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            sync_service.transfer(
                request.user, game, data.validated_data["accountId"], data.validated_data.get("ownerPlayerId")
            )
        except sync_service.TransferError as e:
            if e.code == "forbidden":
                detections.access_denied(request, 1, "transfer")
            code = status.HTTP_403_FORBIDDEN if e.code == "forbidden" else status.HTTP_400_BAD_REQUEST
            return Response({"code": e.code, "detail": e.detail}, status=code)
        return Response(status=status.HTTP_204_NO_CONTENT)


class LeaveGameView(APIView):
    def post(self, request, game_id):
        game = get_object_or_404(visible_games(request.user), pk=game_id)
        if game.owner_id == request.user.pk:
            return Response(
                {"code": "owner_cannot_leave", "detail": "Je bent de eigenaar; verwijder het spel in plaats daarvan."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sync_service.leave(request.user, game)
        return Response(status=status.HTTP_204_NO_CONTENT)
