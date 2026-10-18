# Puntenteller-backend: Django onder uvicorn (ASGI, nodig voor de SSE-stream
# /api/v1/events). Migraties draaien apart
# (initContainer in de Helm-chart): `python manage.py migrate --noinput`.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
# Statische bestanden (Django-admin) in de image; DEBUG alleen voor deze stap,
# zodat er geen echte SECRET_KEY nodig is tijdens het bouwen.
RUN DJANGO_DEBUG=1 python manage.py collectstatic --noinput

RUN useradd --uid 10001 --no-create-home app
USER 10001

EXPOSE 8000
# --proxy-headers: achter de ingress (X-Forwarded-Proto voor https, client-IP
# uit X-Forwarded-For). Alleen proxies in het cluster (privé-adressen) worden
# vertrouwd: uvicorn neemt dan het eerste adres van rechts dat daar buiten valt,
# het IP dat de ingress zelf zag. Met "*" nam hij het meest linkse adres, en
# dat kiest de client zelf. Te overschrijven met FORWARDED_ALLOW_IPS.
ENV FORWARDED_ALLOW_IPS="127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,100.64.0.0/10,fc00::/7"
CMD ["uvicorn", "puntenteller.asgi:application", "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "2", "--proxy-headers"]
