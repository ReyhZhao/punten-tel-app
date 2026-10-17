from rest_framework.throttling import ScopedRateThrottle

from . import detections


class ReportingScopedRateThrottle(ScopedRateThrottle):
    """ScopedRateThrottle die geweigerde verzoeken meetelt voor Polaris."""

    def allow_request(self, request, view):
        allowed = super().allow_request(request, view)
        if not allowed:
            detections.rate_limited(request, self.scope)
        return allowed
