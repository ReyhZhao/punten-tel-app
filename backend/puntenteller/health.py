from django.http import JsonResponse


class HealthCheckMiddleware:
    """
    Beantwoordt `/healthz` vóór de ALLOWED_HOSTS-controle: de probes van
    Kubernetes sturen het IP van de pod als Host-header.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == "/healthz":
            return JsonResponse({"status": "ok"})
        return self.get_response(request)
