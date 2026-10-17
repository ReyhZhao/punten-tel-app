"""
Beveiligingsmeldingen naar Polaris Security (de SOC), volgens de Polaris
ingest-gids (`/agents/ingest.md`). Twee Ingest Endpoints: één voor alerts
(`{"events": [...]}`) en één voor assets (`{"assets": [...]}`).

De URL is het enige wachtwoord. Hij komt alleen uit de omgeving, gaat nooit
naar een client en wordt nooit volledig gelogd: alleen de laatste 4 tekens.
Zonder URL staat dat deel van de koppeling uit en doet niets.

Versturen gebeurt nooit op het verzoek zelf. Events gaan in een begrensde
buffer in het geheugen; een achtergrond-thread stuurt ze elke paar seconden
in batches. Polaris dropt dubbele `event_id`'s, dus een batch na een timeout
opnieuw sturen is veilig. De buffer is wel vluchtig: bij een herstart gaat
wat nog niet verstuurd was verloren.
"""

import ipaddress
import json
import logging
import random
import threading
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from urllib.parse import urlsplit

import httpx
from django.conf import settings
from django.db import close_old_connections

log = logging.getLogger(__name__)

APP_NAME = "puntenteller-api"
SEVERITIES = ("critical", "high", "medium", "low", "info")
MAX_BODY_BYTES = 800_000  # ruim onder de limiet van 1 MB
MAX_BUFFER = 2000
FLUSH_INTERVAL = 5.0  # seconden
FLUSH_AT = 100  # eerder versturen bij zoveel wachtende events
MAX_BACKOFF = 300.0
SNAPSHOT_INTERVAL = 24 * 3600  # volledige asset-snapshot

# Tests zetten hier een httpx.MockTransport.
TRANSPORT = None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def app_info(environment: str | None = None) -> dict:
    info = {"name": APP_NAME, "environment": environment or settings.POLARIS_ENVIRONMENT}
    if settings.APP_VERSION:
        info["version"] = settings.APP_VERSION
    return info


def valid_ip(value) -> str | None:
    try:
        return str(ipaddress.ip_address(str(value).strip()))
    except ValueError:
        return None


def entities(*, user: str | None = None, ip: str | None = None, host: str | None = None) -> dict:
    """
    De entiteiten waarop Polaris correleert, als geneste objecten. Lege
    waarden laten we weg (nooit null, "" of "unknown"). `host` is standaard de
    Kubernetes-node waarop deze pod draait; onbekend = weglaten.
    """
    out = {}
    host = host if host is not None else settings.POLARIS_HOST_NAME
    if host:
        out["host"] = {"name": host}
    if ip and (ip := valid_ip(ip)):
        out["source"] = {"ip": ip}
    if user:
        out["user"] = {"name": user}
    return out


def make_alert(rule, title: str, description: str, ents: dict, context: dict | None = None,
               environment: str | None = None) -> dict:
    """Eén alert. Aanroepen op het moment zelf, zodat `event_id` vastligt vóór het versturen."""
    if not ents:
        raise ValueError("Een alert heeft minstens één entiteit nodig")
    if rule.severity not in SEVERITIES:
        raise ValueError(f"Onbekende severity {rule.severity!r}")
    alert = {
        "event_id": str(uuid.uuid4()),
        "occurred_at": now_iso(),
        "rule": {"id": rule.id, "name": rule.name},
        "severity": rule.severity,
        "title": title[:255],
        "description": description,
        "entities": ents,
        "app": app_info(environment),
    }
    if context:
        alert["context"] = context
    return alert


def _url_allowed(url: str) -> bool:
    """Alleen HTTPS; HTTP mag alleen naar localhost (lokaal testen)."""
    parts = urlsplit(url)
    if parts.scheme == "https":
        return True
    return parts.scheme == "http" and parts.hostname in {"localhost", "127.0.0.1", "::1"}


def url_label(url: str) -> str:
    """Wat we van een ingest-URL in logs zetten: alleen de laatste 4 tekens."""
    return "…" + url.rstrip("/")[-4:]


class Sender:
    """Buffer plus aflevering voor één Ingest Endpoint."""

    def __init__(self, url: str, key: str):
        self.url = url
        self.key = key  # "events" of "assets"
        self.label = f"{key} {url_label(url)}"
        self.captured = deque(maxlen=50)  # captured_payload-id's, voor het testcommando
        self._buffer: list[dict] = []
        self._lock = threading.Lock()
        self._send_lock = threading.Lock()
        self._failures = 0
        self._retry_at = 0.0
        self._client = httpx.Client(
            timeout=httpx.Timeout(15.0, connect=5.0), transport=TRANSPORT, follow_redirects=False
        )

    def enqueue(self, item: dict) -> int:
        with self._lock:
            self._buffer.append(item)
            self._enforce_cap()
            return len(self._buffer)

    def pending(self) -> int:
        with self._lock:
            return len(self._buffer)

    def _enforce_cap(self) -> None:
        """Te vol: laagste severity eerst eruit, en daarbinnen de oudste."""
        rank = {s: i for i, s in enumerate(SEVERITIES)}
        dropped = 0
        while len(self._buffer) > MAX_BUFFER:
            i = max(range(len(self._buffer)),
                    key=lambda i: (rank.get(self._buffer[i].get("severity"), len(SEVERITIES)), -i))
            self._buffer.pop(i)
            dropped += 1
        if dropped:
            log.warning("Polaris (%s): buffer vol, %d event(s) met de laagste severity weggegooid",
                        self.label, dropped)

    def flush(self, force: bool = False) -> bool:
        """Stuurt alles wat wacht. True als de buffer daarna leeg is."""
        if not force and time.monotonic() < self._retry_at:
            return False
        with self._send_lock:
            with self._lock:
                batch, self._buffer = self._buffer, []
            if not batch:
                return True
            retry = self.deliver(batch)
            with self._lock:
                self._buffer = retry + self._buffer
                self._enforce_cap()
            if retry:
                self._failures += 1
                delay = min(MAX_BACKOFF, 2 ** (self._failures - 1)) * (0.5 + random.random())
                self._retry_at = time.monotonic() + delay
                log.warning("Polaris (%s): %d item(s) blijven in de buffer, nieuwe poging over %.0f s",
                            self.label, len(retry), delay)
                return False
            self._failures = 0
            self._retry_at = 0.0
            return True

    def deliver(self, items: list[dict]) -> list[dict]:
        """Eén POST (of meer na splitsen). Geeft terug wat later opnieuw moet."""
        body = json.dumps({self.key: items}, separators=(",", ":")).encode()
        if len(body) > MAX_BODY_BYTES and len(items) > 1:
            return self._split(items)
        try:
            r = self._client.post(self.url, content=body, headers={"Content-Type": "application/json"})
        except httpx.HTTPError as e:
            # Niet str(e) loggen: daar kan de volledige URL in staan.
            log.warning("Polaris (%s): versturen mislukt (%s)", self.label, type(e).__name__)
            return items
        if 200 <= r.status_code < 300:
            try:
                captured = r.json().get("captured_payload")
            except ValueError:
                captured = None
            self.captured.append(captured)
            log.debug("Polaris (%s): %d item(s) ontvangen, captured_payload=%s", self.label, len(items), captured)
            return []
        if r.status_code == 413 and len(items) > 1:
            return self._split(items)
        if r.status_code == 429 or r.status_code >= 500:
            return items
        # 400 (fout bij ons), 404 (URL onbekend, ingetrokken of gepauzeerd), 413
        # met één item: opnieuw sturen helpt niet, en Polaris heeft niets bewaard.
        log.error(
            "Polaris ingest URL rejected the batch (HTTP %d) for %s: %d item(s) dropped. "
            "Check POLARIS_*_INGEST_URL.", r.status_code, self.label, len(items),
        )
        return []

    def _split(self, items: list[dict]) -> list[dict]:
        mid = len(items) // 2
        return self.deliver(items[:mid]) + self.deliver(items[mid:])


_senders: dict[tuple[str, str], Sender] = {}
_senders_lock = threading.Lock()
_warned: set[str] = set()
_wake = threading.Event()
_worker: threading.Thread | None = None


def sender(key: str) -> Sender | None:
    """De sender voor "events" of "assets", of None als die uit staat."""
    url = settings.POLARIS_ALERT_INGEST_URL if key == "events" else settings.POLARIS_ASSET_INGEST_URL
    if not url:
        return None
    if not _url_allowed(url):
        if url not in _warned:
            _warned.add(url)
            log.error("Polaris (%s %s): ingest-URL moet https zijn; koppeling staat uit", key, url_label(url))
        return None
    with _senders_lock:
        s = _senders.get((key, url))
        if s is None:
            s = _senders[(key, url)] = Sender(url, key)
        return s


def enabled() -> bool:
    return sender("events") is not None or sender("assets") is not None


def send_alert(alert: dict) -> None:
    s = sender("events")
    if s is None:
        return
    _queued(s.enqueue(alert))


def send_asset(asset: dict) -> None:
    s = sender("assets")
    if s is None:
        return
    _queued(s.enqueue(asset))


def _queued(pending: int) -> None:
    if not settings.POLARIS_ASYNC:
        return  # tests en commando's roepen flush_all() zelf aan
    ensure_worker()
    if pending >= FLUSH_AT:
        _wake.set()


def flush_all(force: bool = False) -> bool:
    with _senders_lock:
        senders = list(_senders.values())
    return all([s.flush(force) for s in senders])


def reset() -> None:
    """Voor tests: alle buffers en senders weg."""
    with _senders_lock:
        _senders.clear()
    _warned.clear()


def ensure_worker(**_) -> None:
    """Start de achtergrond-thread (één per proces). Ook als signal-receiver."""
    global _worker
    if not settings.POLARIS_ASYNC or (_worker is not None and _worker.is_alive()) or not enabled():
        return
    with _senders_lock:
        if _worker is None or not _worker.is_alive():
            _worker = threading.Thread(target=_run, name="polaris", daemon=True)
            _worker.start()


def _run() -> None:
    from .assets import queue_snapshot

    next_snapshot = 0.0
    while True:
        _wake.wait(FLUSH_INTERVAL)
        _wake.clear()
        try:
            if time.monotonic() >= next_snapshot:
                next_snapshot = time.monotonic() + 60  # bij een fout over een minuut opnieuw
                queue_snapshot()
                next_snapshot = time.monotonic() + SNAPSHOT_INTERVAL
            flush_all()
        except Exception:
            log.exception("Polaris: versturen mislukt")
        finally:
            close_old_connections()
