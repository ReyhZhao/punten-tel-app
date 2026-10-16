from django.conf import settings
from django.core.mail import send_mail

from .models import User


def send_login_code(user: User, code: str) -> None:
    minutes = settings.LOGIN_CODE_TTL_MINUTES
    send_mail(
        subject=f"Je Puntenteller-code: {code}",
        message=(
            f"Hoi {user.display_name},\n\n"
            f"Je code om in te loggen bij Puntenteller is:\n\n"
            f"    {code}\n\n"
            f"De code is {minutes} minuten geldig. Heb je dit niet zelf aangevraagd? "
            f"Dan kun je deze e-mail negeren.\n"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )
