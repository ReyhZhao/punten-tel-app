"""
Aanmelden en inloggen zonder wachtwoord.

1. `POST auth/request-code` met e-mail (en schermnaam bij een nieuw account):
   de backend mailt een 6-cijferige code.
2. `POST auth/verify` met e-mail en code: geeft een token voor dit toestel.
"""

import hmac

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from games.access import revoke_all_for_owner
from games.serializers import iso

from .emails import send_login_code
from .models import AuthToken, InviteCode, LoginCode, User, normalize_email
from .serializers import AccountSerializer, RequestCodeSerializer, VerifyCodeSerializer

# Maximaal aantal codes per e-mailadres per uur (naast de throttle per IP).
CODES_PER_EMAIL_PER_HOUR = 5


def error(code: str, detail: str, http_status: int) -> Response:
    return Response({"code": code, "detail": detail}, status=http_status)


def is_review_account(email: str) -> bool:
    """Het review-account voor Apple (vaste code, geen e-mail); zie settings."""
    return bool(settings.REVIEW_ACCOUNT_EMAIL and settings.REVIEW_ACCOUNT_CODE) and email == settings.REVIEW_ACCOUNT_EMAIL


class RequestCodeView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        data = RequestCodeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        email = normalize_email(data.validated_data["email"])
        display_name = data.validated_data.get("displayName", "").strip()

        key = f"login-codes:{email}"
        if cache.get(key, 0) >= CODES_PER_EMAIL_PER_HOUR:
            return error("too_many_requests", "Te veel codes aangevraagd. Probeer het over een uur opnieuw.",
                         status.HTTP_429_TOO_MANY_REQUESTS)

        if is_review_account(email):
            user, created = User.objects.get_or_create(
                email=email, defaults={"display_name": display_name or "App Review"}
            )
            return Response({"sent": True, "newAccount": created}, status=status.HTTP_202_ACCEPTED)

        user = User.objects.filter(email=email).first()
        if user is None:
            if not display_name:
                # De app toont dan het aanmeldformulier met schermnaam.
                return error("account_not_found", "Er is nog geen account met dit e-mailadres.",
                             status.HTTP_404_NOT_FOUND)
            user = User.objects.create_user(email=email, display_name=display_name)
        elif not user.is_verified and display_name:
            # Nog niet bevestigd: de schermnaam mag bij een nieuwe poging nog wijzigen.
            user.display_name = display_name
            user.save(update_fields=["display_name"])

        if not user.is_active:
            return error("account_disabled", "Dit account is uitgeschakeld.", status.HTTP_403_FORBIDDEN)

        code = LoginCode.issue(user)
        send_login_code(user, code)
        cache.add(key, 0, timeout=3600)
        cache.incr(key)
        return Response({"sent": True, "newAccount": not user.is_verified}, status=status.HTTP_202_ACCEPTED)


class VerifyCodeView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        data = VerifyCodeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        email = normalize_email(data.validated_data["email"])
        invalid = error("invalid_code", "Deze code klopt niet.", status.HTTP_400_BAD_REQUEST)

        if is_review_account(email):
            user = User.objects.filter(email=email, is_active=True).first()
            code = data.validated_data["code"].strip()
            if user is None or not hmac.compare_digest(code, settings.REVIEW_ACCOUNT_CODE):
                return invalid
            if not user.is_verified:
                user.is_verified = True
                user.save(update_fields=["is_verified"])
            _, key = AuthToken.create_for(user, data.validated_data.get("deviceName", ""))
            return Response({"token": key, "account": AccountSerializer(user).data})

        with transaction.atomic():
            login = (
                LoginCode.objects.select_for_update()
                .select_related("user")
                .filter(user__email=email, used_at__isnull=True)
                .order_by("-created_at")
                .first()
            )
            if login is None:
                return invalid
            if login.is_expired:
                return error("code_expired", "Deze code is verlopen. Vraag een nieuwe aan.", status.HTTP_400_BAD_REQUEST)
            if login.attempts >= settings.LOGIN_CODE_MAX_ATTEMPTS:
                return error("too_many_attempts", "Te vaak een verkeerde code. Vraag een nieuwe aan.",
                             status.HTTP_400_BAD_REQUEST)
            if not login.matches(data.validated_data["code"]):
                login.attempts += 1
                login.save(update_fields=["attempts"])
                return invalid

            login.used_at = timezone.now()
            login.save(update_fields=["used_at"])
            user = login.user
            if not user.is_verified:
                user.is_verified = True
                user.save(update_fields=["is_verified"])
            _, key = AuthToken.create_for(user, data.validated_data.get("deviceName", ""))

        return Response({"token": key, "account": AccountSerializer(user).data})


class LogoutView(APIView):
    def post(self, request):
        request.auth.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    def get(self, request):
        return Response(AccountSerializer(request.user).data)

    def patch(self, request):
        serializer = AccountSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request):
        """Account en alle eigen spellen verwijderen (App Store-eis)."""
        with transaction.atomic():
            revoke_all_for_owner(request.user)
            request.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class InviteCodeView(APIView):
    """
    Uitnodigcode tonen: een medespeler vult hem in (of scant de QR-code) om je
    uit te nodigen zonder je e-mailadres te kennen. Elke aanvraag geeft een
    nieuwe code; de vorige vervalt.
    """

    def post(self, request):
        if not request.user.is_verified:
            return error("not_verified", "Bevestig eerst je e-mailadres.", status.HTTP_403_FORBIDDEN)
        code, invite = InviteCode.issue(request.user)
        return Response({"code": code, "expiresAt": iso(invite.expires_at)}, status=status.HTTP_201_CREATED)
