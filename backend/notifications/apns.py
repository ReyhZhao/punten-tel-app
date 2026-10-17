"""
Minimale client voor Apple Push Notification service (APNs), via HTTP/2 met
token-authenticatie (een .p8-sleutel uit het Apple Developer-account).

Instellingen (env): APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY (inhoud van
de .p8), APNS_TOPIC (bundle-id). Zonder sleutel staat push uit.
"""

import logging
import threading
import time

import httpx
import jwt
from django.conf import settings

log = logging.getLogger(__name__)

HOSTS = {
    "production": "https://api.push.apple.com",
    "sandbox": "https://api.sandbox.push.apple.com",
}

# Antwoorden waarbij het toestel-token niet meer bruikbaar is.
DEAD_TOKEN_REASONS = {"BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"}


class APNsClient:
    # Apple accepteert een token maximaal een uur en wil niet vaker dan eens
    # per 20 minuten een nieuw; we vernieuwen na 45 minuten.
    TOKEN_TTL = 45 * 60

    def __init__(self, key_id: str, team_id: str, private_key: str, topic: str, transport=None):
        self.key_id = key_id
        self.team_id = team_id
        self.private_key = private_key
        self.topic = topic
        self._transport = transport
        self._token: tuple[str, float] | None = None
        self._lock = threading.Lock()
        self._clients: dict[str, httpx.Client] = {}

    def _auth_token(self) -> str:
        with self._lock:
            if self._token is None or time.time() - self._token[1] > self.TOKEN_TTL:
                issued = time.time()
                token = jwt.encode(
                    {"iss": self.team_id, "iat": int(issued)},
                    self.private_key,
                    algorithm="ES256",
                    headers={"kid": self.key_id},
                )
                self._token = (token, issued)
            return self._token[0]

    def _client(self, environment: str) -> httpx.Client:
        with self._lock:
            if environment not in self._clients:
                self._clients[environment] = httpx.Client(
                    base_url=HOSTS[environment], http2=self._transport is None,
                    transport=self._transport, timeout=10,
                )
            return self._clients[environment]

    def send(self, device_token: str, environment: str, payload: dict, collapse_id: str | None = None) -> str | None:
        """
        Stuurt één melding. Geeft None bij succes, anders de reden van Apple
        (bv. "Unregistered").
        """
        headers = {
            "authorization": f"bearer {self._auth_token()}",
            "apns-topic": self.topic,
            "apns-push-type": "alert",
            "apns-priority": "10",
        }
        if collapse_id:
            headers["apns-collapse-id"] = collapse_id[:64]
        try:
            response = self._client(environment).post(f"/3/device/{device_token}", json=payload, headers=headers)
        except httpx.HTTPError as e:
            log.warning("APNs onbereikbaar: %s", e)
            return "Unreachable"
        if response.status_code == 200:
            return None
        try:
            reason = response.json().get("reason", f"HTTP {response.status_code}")
        except ValueError:
            reason = f"HTTP {response.status_code}"
        log.warning("APNs weigerde melding (%s): %s", response.status_code, reason)
        return reason


_client: APNsClient | None = None
_client_lock = threading.Lock()


def get_client() -> APNsClient | None:
    """De client volgens de instellingen, of None als push niet is ingesteld."""
    global _client
    if not (settings.APNS_KEY_ID and settings.APNS_TEAM_ID and settings.APNS_PRIVATE_KEY):
        return None
    with _client_lock:
        if _client is None:
            _client = APNsClient(
                settings.APNS_KEY_ID, settings.APNS_TEAM_ID,
                settings.APNS_PRIVATE_KEY.replace("\\n", "\n"), settings.APNS_TOPIC,
            )
        return _client
