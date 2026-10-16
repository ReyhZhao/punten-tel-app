# Puntenteller-backend: Django + Gunicorn. Migraties draaien apart
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
CMD ["gunicorn", "puntenteller.wsgi", "--bind", "0.0.0.0:8000", "--workers", "3", "--access-logfile", "-"]
