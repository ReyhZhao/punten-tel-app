{{/*
Omgevingsvariabelen van de backend (gedeeld door migratie en app).
De databasegegevens komen uit de Secret die CloudNativePG aanmaakt:
"<postgres.clusterName>-app".
*/}}
{{- define "punten.apiEnv" -}}
{{- $db := printf "%s-app" .Values.postgres.clusterName -}}
- name: DJANGO_ALLOWED_HOSTS
  value: {{ .Values.host | quote }}
- name: DJANGO_CSRF_TRUSTED_ORIGINS
  value: {{ printf "https://%s" .Values.host | quote }}
{{- range $env, $key := dict "POSTGRES_HOST" "host" "POSTGRES_PORT" "port" "POSTGRES_DB" "dbname" "POSTGRES_USER" "username" "POSTGRES_PASSWORD" "password" }}
- name: {{ $env }}
  valueFrom:
    secretKeyRef:
      name: {{ $db }}
      key: {{ $key }}
{{- end }}
- name: EMAIL_HOST
  value: {{ .Values.api.email.host | quote }}
- name: EMAIL_PORT
  value: {{ .Values.api.email.port | quote }}
- name: EMAIL_HOST_USER
  value: {{ .Values.api.email.user | quote }}
- name: EMAIL_USE_TLS
  value: {{ .Values.api.email.useTls | quote }}
- name: DEFAULT_FROM_EMAIL
  value: {{ .Values.api.email.from | quote }}
{{- end }}
