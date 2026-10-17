"""
Django-signalen: inloggen op /admin/ (het enige inloggen met wachtwoord) en
wijzigingen in beheerrechten. Wordt geladen vanuit PolarisConfig.ready().
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.signals import user_logged_in, user_login_failed
from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from . import client, detections
from .assets import is_privileged, user_asset

User = get_user_model()
FLAGS = ("is_staff", "is_superuser", "is_active")


@receiver(user_login_failed)
def on_login_failed(sender, credentials, request=None, **kwargs):
    # Django vervangt het wachtwoord in `credentials` al door sterretjes; we nemen alleen de naam.
    detections.admin_login_failed(request, str(credentials.get("username", "")).strip().lower())


@receiver(user_logged_in)
def on_logged_in(sender, request, user, **kwargs):
    detections.admin_logged_in(request, user)


@receiver(pre_save, sender=User)
def remember_flags(sender, instance, update_fields=None, raw=False, **kwargs):
    if raw or (update_fields is not None and not set(update_fields) & set(FLAGS)):
        instance._polaris_before = None
        return
    if instance._state.adding:
        instance._polaris_before = dict.fromkeys(FLAGS, False)
    else:
        instance._polaris_before = User.objects.filter(pk=instance.pk).values(*FLAGS).first()


@receiver(post_save, sender=User)
def on_user_saved(sender, instance, **kwargs):
    before = getattr(instance, "_polaris_before", None)
    instance._polaris_before = None
    if before is None:
        return
    granted = [f for f in ("is_staff", "is_superuser") if getattr(instance, f) and not before[f]]
    was_privileged = bool(before["is_active"] and (before["is_staff"] or before["is_superuser"]))
    now_privileged = is_privileged(instance)

    if granted:
        transaction.on_commit(lambda: detections.privilege_granted(instance, granted))
    if was_privileged != now_privileged or (now_privileged and granted):
        asset = user_asset(instance)
        transaction.on_commit(lambda: client.send_asset(asset))


@receiver(post_delete, sender=User)
def on_user_deleted(sender, instance, **kwargs):
    if is_privileged(instance):
        # Polaris kent geen verwijderen: laatste stand is "geen beheerder meer".
        asset = user_asset(instance, privileged=False)
        transaction.on_commit(lambda: client.send_asset(asset))
