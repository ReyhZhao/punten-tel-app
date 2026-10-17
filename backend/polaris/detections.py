"""
Welke beveiligingsgebeurtenissen we als alert naar Polaris sturen, en wanneer.

Luidruchtige gebeurtenissen (foute codes, ongeldige tokens, throttles) tellen
we eerst op in de cache, over een vast venster vanaf de eerste treffer. Pas
bij een drempel gaat er één alert per (detectie, onderwerp) per venster uit.
De cache staat per proces in het geheugen, net als de rate limiting (zie
README, "Opschalen"). Met meer processen gelden de drempels dus per proces.

`rule.id` en `rule.name` zijn per detectie vast. Wat per keer verschilt
(adres, IP, aantallen), gaat in `title`, `description` en `context`. Codes,
tokens en wachtwoorden komen nooit in een alert.
"""

import hashlib
import time
from dataclasses import dataclass

from django.core.cache import cache

from . import client

APP = client.APP_NAME


@dataclass(frozen=True)
class Rule:
    id: str
    name: str
    severity: str
    threshold: int = 1
    window: int = 3600  # seconden
    when: str = ""  # voor de detectiecatalogus in POLARIS_INTEGRATION.md
    guidance: str = ""


LOGIN_CODE_BRUTEFORCE = Rule(
    f"{APP}.auth.login-code-bruteforce", "Login code brute force against a single account", "medium",
    threshold=10, window=3600,
    when="≥ 10 wrong or exhausted login codes for one account within 60 min (all source IPs)",
    guidance="Check context.source_ips. A single shared IP is often a household or game table; many IPs suggest a "
             "distributed guess. Watch for auth.login-after-failures on the same account.",
)
LOGIN_FAILURES_FROM_IP = Rule(
    f"{APP}.auth.login-failures-from-ip", "Failed logins across several accounts from one IP", "medium",
    threshold=10, window=3600,
    when="≥ 10 failed login-code verifications from one IP within 60 min, against ≥ 3 different e-mail addresses",
    guidance="Credential-stuffing pattern. Check whether any of those accounts later logged in from this IP.",
)
LOGIN_AFTER_FAILURES = Rule(
    f"{APP}.auth.login-after-failures", "Successful login after repeated failed login codes", "high",
    threshold=5, window=3600,
    when="A successful login for an account that had ≥ 5 failed codes within the previous 60 min",
    guidance="Possible guessed code. Contact the account owner; if they did not log in, untick 'active' for the "
             "account in /admin/: all its device tokens stop working at once.",
)
CODE_REQUEST_LIMIT = Rule(
    f"{APP}.auth.code-request-limit", "Login code request limit reached for an account", "low",
    threshold=1, window=3600,
    when="The per-address limit (5 login codes per hour) is hit for one e-mail address; once per address per hour",
    guidance="Either a user struggling to log in or someone mail-bombing / probing an address. Usually no action.",
)
RATE_LIMITED = Rule(
    f"{APP}.abuse.rate-limited", "Rate limit tripped repeatedly by one source", "low",
    threshold=5, window=3600,
    when="≥ 5 throttled requests (login or account lookup throttle) from one IP within 60 min",
    guidance="Abuse signal for correlation. Players at one table share an IP, so a single alert is rarely actionable.",
)
LOOKUP_ENUMERATION = Rule(
    f"{APP}.account.lookup-enumeration", "Account or invite code enumeration", "medium",
    threshold=15, window=3600,
    when="≥ 15 account lookups (by e-mail or 6-digit invite code) without a match by one account within 60 min",
    guidance="An authenticated account is guessing e-mail addresses or invite codes. Consider deactivating it.",
)
INVALID_TOKENS = Rule(
    f"{APP}.auth.invalid-token-volume", "Many different invalid bearer tokens from one IP", "medium",
    threshold=10, window=600,
    when="≥ 10 distinct invalid or revoked bearer tokens presented from one IP within 10 min",
    guidance="Token guessing or replay of leaked tokens. A single stale app repeats one token and does not trip this.",
)
ACCESS_DENIED = Rule(
    f"{APP}.authz.access-denied-volume", "Repeated forbidden changes by one account", "medium",
    threshold=10, window=3600,
    when="≥ 10 requests within 60 min in which one account tried to change games, players or scores it may not "
         "change (sync rejections with reason forbidden, forbidden game transfers)",
    guidance="Possible IDOR probing with guessed ids, or a modified client. Check context.forbidden_changes.",
)
ADMIN_LOGIN_BRUTEFORCE = Rule(
    f"{APP}.admin.login-bruteforce", "Brute force against the Django admin login", "high",
    threshold=10, window=900,
    when="≥ 10 failed /admin/ password logins for one username, or from one IP, within 15 min",
    guidance="Admin accounts are the only password accounts. Block the source IP at the ingress if it persists.",
)
ADMIN_LOGIN_AFTER_FAILURES = Rule(
    f"{APP}.admin.login-after-failures", "Admin login after repeated failed attempts", "high",
    threshold=5, window=900,
    when="A successful /admin/ login for a username that had ≥ 5 failed attempts within the previous 15 min",
    guidance="Confirm with the admin that it was them; if not, change the password and review recent admin changes.",
)
PRIVILEGE_GRANTED = Rule(
    f"{APP}.authz.privilege-granted", "Account granted Django admin rights", "high",
    when="An account gets is_staff or is_superuser (via /admin/, createsuperuser or the shell)",
    guidance="Verify the change with the app owner. Unexpected grants mean someone already has admin or database access.",
)

RULES = [
    LOGIN_CODE_BRUTEFORCE, LOGIN_FAILURES_FROM_IP, LOGIN_AFTER_FAILURES, CODE_REQUEST_LIMIT, RATE_LIMITED,
    LOOKUP_ENUMERATION, INVALID_TOKENS, ACCESS_DENIED, ADMIN_LOGIN_BRUTEFORCE, ADMIN_LOGIN_AFTER_FAILURES,
    PRIVILEGE_GRANTED,
]


def client_ip(request) -> str | None:
    """
    Het IP van de client. uvicorn draait met --proxy-headers achter de ingress
    en zet REMOTE_ADDR al op het adres uit X-Forwarded-For.
    """
    if request is None:
        return None
    return client.valid_ip(request.META.get("REMOTE_ADDR", ""))


def _key(*parts) -> str:
    """Cache-sleutel zonder e-mailadressen of IP's erin (en veilig voor memcached)."""
    raw = ":".join(str(p) for p in parts)
    return "polaris:" + hashlib.sha256(raw.encode()).hexdigest()[:32]


def _hit(rule: Rule, *subject) -> int:
    key = _key("count", rule.id, *subject)
    cache.add(key, 0, timeout=rule.window)
    try:
        return cache.incr(key)
    except ValueError:  # net verlopen
        cache.set(key, 1, timeout=rule.window)
        return 1


def _count(rule: Rule, *subject) -> int:
    return cache.get(_key("count", rule.id, *subject), 0)


def _distinct(rule: Rule, subject, value: str, cap: int = 50) -> list[str]:
    """Verschillende waarden binnen het venster (begrensd)."""
    key = _key("distinct", rule.id, subject)
    now = time.time()
    state = cache.get(key)
    if state is None or state["until"] <= now:
        state = {"until": now + rule.window, "values": []}
    if value not in state["values"] and len(state["values"]) < cap:
        state["values"].append(value)
    cache.set(key, state, timeout=max(1, int(state["until"] - now)))
    return state["values"]


def _once(rule: Rule, *subject) -> bool:
    """True de eerste keer per venster: zo gaat er één alert per onderwerp uit."""
    return cache.add(_key("fired", rule.id, *subject), 1, timeout=rule.window)


def _minutes(rule: Rule) -> int:
    return rule.window // 60


def report(rule: Rule, title: str, description: str, *, user=None, ip=None, context=None) -> dict | None:
    ents = client.entities(user=user, ip=ip)
    if not ents:
        return None
    alert = client.make_alert(rule, title, description, ents, context)
    client.send_alert(alert)
    return alert


# --- Inloggen met een code (accounts.views) ---------------------------------

def login_failed(request, email: str, user=None) -> None:
    """Foute, of al te vaak geprobeerde, inlogcode. `user` is None bij een onbekend adres."""
    ip = client_ip(request)
    if user is not None:
        rule = LOGIN_CODE_BRUTEFORCE
        n = _hit(rule, user.pk)
        ips = _distinct(rule, user.pk, ip) if ip else []
        if n >= rule.threshold and _once(rule, user.pk):
            report(
                rule,
                f"{n} failed login codes for {email} in {_minutes(rule)} minutes",
                f"The account {email} received {n} wrong or exhausted 6-digit login codes within "
                f"{_minutes(rule)} minutes from {len(ips)} source IP(s). The app allows 5 attempts per code and "
                f"5 codes per address per hour; the account is not locked.",
                user=email, ip=ip,
                context={"failed_attempts": n, "window_minutes": _minutes(rule), "source_ips": ips},
            )
    if ip:
        rule = LOGIN_FAILURES_FROM_IP
        n = _hit(rule, ip)
        emails = _distinct(rule, ip, email)
        if n >= rule.threshold and len(emails) >= 3 and _once(rule, ip):
            report(
                rule,
                f"{n} failed logins for {len(emails)} accounts from {ip} in {_minutes(rule)} minutes",
                f"{ip} submitted {n} failed login codes for {len(emails)} different e-mail addresses within "
                f"{_minutes(rule)} minutes. The per-IP throttle limits further attempts.",
                ip=ip,
                context={"failed_attempts": n, "window_minutes": _minutes(rule), "accounts": emails},
            )


def login_succeeded(request, user) -> None:
    rule = LOGIN_AFTER_FAILURES
    failures = _count(LOGIN_CODE_BRUTEFORCE, user.pk)
    if failures >= rule.threshold and _once(rule, user.pk):
        ip = client_ip(request)
        report(
            rule,
            f"{user.email} logged in after {failures} failed login codes",
            f"{user.email} logged in successfully from {ip or 'an unknown IP'} after {failures} failed login "
            f"codes within {_minutes(rule)} minutes. The app issued a new device token for this login.",
            user=user.email, ip=ip,
            context={"failed_attempts": failures, "window_minutes": _minutes(rule),
                     "source_ips": _distinct(LOGIN_CODE_BRUTEFORCE, user.pk, ip) if ip else []},
        )


def code_request_limited(request, email: str) -> None:
    rule = CODE_REQUEST_LIMIT
    if _once(rule, email):
        ip = client_ip(request)
        report(
            rule,
            f"Login code request limit reached for {email}",
            f"Login codes for {email} were requested more than 5 times within an hour (latest from "
            f"{ip or 'an unknown IP'}). Further requests are refused for the rest of the hour.",
            user=email, ip=ip,
        )


def rate_limited(request, scope: str) -> None:
    ip = client_ip(request)
    if not ip:
        return
    rule = RATE_LIMITED
    n = _hit(rule, ip)
    scopes = _distinct(rule, ip, scope)
    if n >= rule.threshold and _once(rule, ip):
        user = getattr(getattr(request, "user", None), "email", None)
        report(
            rule,
            f"{ip} was rate limited {n} times in {_minutes(rule)} minutes",
            f"Requests from {ip} were throttled {n} times within {_minutes(rule)} minutes "
            f"(scopes: {', '.join(scopes)}). Throttled requests are refused with HTTP 429.",
            user=user, ip=ip,
            context={"throttled_requests": n, "window_minutes": _minutes(rule), "scopes": scopes},
        )


# --- Spelers zoeken (games.views) -------------------------------------------

def lookup_missed(request, kind: str) -> None:
    """Een lookup op e-mail of uitnodigcode zonder match."""
    rule = LOOKUP_ENUMERATION
    user = request.user
    n = _hit(rule, user.pk)
    if n >= rule.threshold and _once(rule, user.pk):
        report(
            rule,
            f"{user.email} made {n} account lookups without a match in {_minutes(rule)} minutes",
            f"The account {user.email} searched {n} times for other players by e-mail address or invite code "
            f"without a match within {_minutes(rule)} minutes (latest by {kind}). Lookups are throttled per account.",
            user=user.email, ip=client_ip(request),
            context={"misses": n, "window_minutes": _minutes(rule), "latest_kind": kind},
        )


# --- Tokens (accounts.authentication) ---------------------------------------

def invalid_token(request, key: str) -> None:
    ip = client_ip(request)
    if not ip:
        return
    rule = INVALID_TOKENS
    # Alleen een korte hash om te tellen; het token zelf verlaat dit proces nooit.
    tokens = _distinct(rule, ip, hashlib.sha256(key.encode()).hexdigest()[:16])
    if len(tokens) >= rule.threshold and _once(rule, ip):
        report(
            rule,
            f"{len(tokens)} different invalid bearer tokens from {ip} in {_minutes(rule)} minutes",
            f"{ip} presented {len(tokens)} different bearer tokens that do not exist (or were revoked) within "
            f"{_minutes(rule)} minutes. All were refused with HTTP 401.",
            ip=ip,
            context={"distinct_tokens": len(tokens), "window_minutes": _minutes(rule)},
        )


# --- Rechten op spellen (games.views) ---------------------------------------

def access_denied(request, forbidden: int, action: str) -> None:
    """Een verzoek waarin `forbidden` wijzigingen geweigerd zijn."""
    rule = ACCESS_DENIED
    user = request.user
    n = _hit(rule, user.pk)
    total = cache.get(_key("forbidden-total", user.pk), 0) + forbidden
    cache.set(_key("forbidden-total", user.pk), total, timeout=rule.window)
    if n >= rule.threshold and _once(rule, user.pk):
        report(
            rule,
            f"{user.email} sent {n} requests with forbidden changes in {_minutes(rule)} minutes",
            f"The account {user.email} sent {n} requests within {_minutes(rule)} minutes that tried to change "
            f"games, players or scores it has no rights to ({total} changes refused, latest via {action}). "
            f"The app refused all of them.",
            user=user.email, ip=client_ip(request),
            context={"requests": n, "forbidden_changes": total, "window_minutes": _minutes(rule),
                     "latest_action": action},
        )


# --- Django-admin (polaris.signals) -----------------------------------------

def admin_login_failed(request, username: str) -> None:
    rule = ADMIN_LOGIN_BRUTEFORCE
    ip = client_ip(request)
    per_user = _hit(rule, "user", username) if username else 0
    per_ip = _hit(rule, "ip", ip) if ip else 0
    for subject, n in (("user", per_user), ("ip", per_ip)):
        value = username if subject == "user" else ip
        if n >= rule.threshold and _once(rule, subject, value):
            report(
                rule,
                f"{n} failed admin logins for {'username ' + username if subject == 'user' else ip} "
                f"in {_minutes(rule)} minutes",
                f"The Django admin (/admin/) refused {n} password logins "
                f"{'for ' + username if subject == 'user' else 'from ' + ip} within {_minutes(rule)} minutes. "
                f"The admin login has no lockout.",
                user=username or None, ip=ip,
                context={"failed_attempts": n, "window_minutes": _minutes(rule), "counted_by": subject},
            )


def admin_logged_in(request, user) -> None:
    rule = ADMIN_LOGIN_AFTER_FAILURES
    failures = _count(ADMIN_LOGIN_BRUTEFORCE, "user", user.email)
    if failures >= rule.threshold and _once(rule, user.email):
        ip = client_ip(request)
        report(
            rule,
            f"Admin {user.email} logged in after {failures} failed attempts",
            f"{user.email} logged in to the Django admin from {ip or 'an unknown IP'} after {failures} failed "
            f"password attempts within {_minutes(rule)} minutes.",
            user=user.email, ip=ip,
            context={"failed_attempts": failures, "window_minutes": _minutes(rule),
                     "is_superuser": user.is_superuser},
        )


def privilege_granted(user, granted: list[str]) -> None:
    report(
        PRIVILEGE_GRANTED,
        f"{user.email} was granted {' and '.join(granted)}",
        f"The account {user.email} now has {' and '.join(granted)} and can use the Django admin "
        f"(/admin/){', with all permissions' if 'is_superuser' in granted else ''}. The app does not record "
        f"who made the change.",
        user=user.email,
        context={"granted": granted, "is_active": user.is_active},
    )
