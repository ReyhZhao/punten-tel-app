# Polaris integration: Puntenteller API

Handoff for the Polaris SOC. The Puntenteller backend (`backend/`, Django, served at
`https://punten.vels.online/api/`) reports security events to Polaris as **Alerts** and
keeps its **Assets** (the host and the admin accounts) up to date. The payloads follow
the recommended shapes in the Polaris ingest guide exactly, so the mapping tables
below are the guide's tables, unchanged.

Code: `backend/polaris/` (detections in `detections.py`, sender in `client.py`, assets in
`assets.py`). Tests: `backend/polaris/tests/`.

## 1. Endpoints requested

| Record type | Sent | Env var | Endpoint (last 4) |
|---|---|---|---|
| Alert | yes | `POLARIS_ALERT_INGEST_URL` | `…621e` |
| Asset | yes | `POLARIS_ASSET_INGEST_URL` | `…f440` |
| Incident | **no** | none | none |

**Organization:** Puntenteller (vels.online)

No Incident endpoint is needed. The app never reaches a confirmed conclusion by itself
(such as a confirmed account takeover). The two `high` detections become Incidents
through Polaris's own auto-promotion.

## 2. Detection catalogue

`app.name` is always `puntenteller-api`. Thresholds count over a fixed window that starts
at the first matching event, and each (detection, subject) fires **at most once per
window**. Per-event values (addresses, IPs, counts) go only in `title`, `description` and
`context`.

| rule.id | rule.name | severity | When it fires | Entities set | Analyst guidance |
|---|---|---|---|---|---|
| `puntenteller-api.auth.login-code-bruteforce` | Login code brute force against a single account | medium | ≥ 10 wrong or exhausted login codes for one account within 60 min (all source IPs) | user, source.ip, host | Check `context.source_ips`. A single shared IP is often a household or game table; many IPs suggest a distributed guess. Watch for `auth.login-after-failures` on the same account. |
| `puntenteller-api.auth.login-failures-from-ip` | Failed logins across several accounts from one IP | medium | ≥ 10 failed login-code verifications from one IP within 60 min, against ≥ 3 different e-mail addresses | source.ip, host | Credential-stuffing pattern. Check whether any of `context.accounts` later logged in from this IP. |
| `puntenteller-api.auth.login-after-failures` | Successful login after repeated failed login codes | **high** | A successful login for an account that had ≥ 5 failed codes within the previous 60 min | user, source.ip, host | Possible guessed code. Contact the account owner. If they did not log in, untick *active* for the account in `/admin/`: all its device tokens stop working at once. |
| `puntenteller-api.auth.code-request-limit` | Login code request limit reached for an account | low | The per-address limit (5 login codes per hour) is hit for one e-mail address; once per address per hour | user, source.ip, host | Either a user struggling to log in or someone mail-bombing or probing an address. Usually no action. |
| `puntenteller-api.abuse.rate-limited` | Rate limit tripped repeatedly by one source | low | ≥ 5 throttled requests (login, account-lookup, sync, invite-code or push-device throttle) from one IP within 60 min | source.ip, user (if logged in), host | Abuse signal for correlation. Players at one table share an IP, so a single alert is rarely actionable. |
| `puntenteller-api.account.lookup-enumeration` | Account or invite code enumeration | medium | ≥ 15 account lookups (by e-mail or 6-digit invite code) without a match by one account within 60 min | user, source.ip, host | An authenticated account is guessing e-mail addresses or invite codes. Consider deactivating it. |
| `puntenteller-api.auth.invalid-token-volume` | Many different invalid bearer tokens from one IP | medium | ≥ 10 distinct invalid or revoked bearer tokens presented from one IP within 10 min | source.ip, host | Token guessing or replay of leaked tokens. A single stale app repeats one token and does not trip this. |
| `puntenteller-api.authz.access-denied-volume` | Repeated forbidden changes by one account | medium | ≥ 10 requests within 60 min in which one account tried to change games, players or scores it may not change (sync rejections with reason `forbidden`, forbidden game transfers) | user, source.ip, host | Possible IDOR probing with guessed ids, or a modified client. Check `context.forbidden_changes`. |
| `puntenteller-api.admin.login-bruteforce` | Brute force against the Django admin login | **high** | ≥ 10 failed `/admin/` password logins for one username, or from one IP, within 15 min (`context.counted_by` says which) | user, source.ip, host | Admin accounts are the only password accounts. At the same count the admin login locks for that username or IP for the rest of the 15 min window, even with the right password. Block the source IP at the ingress if it persists. |
| `puntenteller-api.admin.login-after-failures` | Admin login after repeated failed attempts | **high** | A successful `/admin/` login for a username that had ≥ 5 failed attempts within the previous 15 min | user, source.ip, host | Confirm with the admin that it was them. If not, change the password and review recent admin changes. |
| `puntenteller-api.authz.privilege-granted` | Account granted Django admin rights | **high** | An account gets `is_staff` or `is_superuser` (via `/admin/`, `createsuperuser` or the shell) | user, host | Verify the change with the app owner. Unexpected grants mean someone already has admin or database access. |
| `puntenteller-api.abuse.login-code-volume` | Unusual volume of login code e-mails | medium | ≥ 50 login code e-mails sent within 60 min across all addresses (sign-ups and logins together) | source.ip (latest), host | Normal use is a handful per hour. Check `context.new_accounts` and `context.source_ips`: many new unverified accounts from few IPs means someone is using the sign-up form to mail-bomb addresses or fill the database. |
| `puntenteller-api.account.login-enumeration` | Account enumeration through the login form | medium | ≥ 10 different unknown e-mail addresses tried on the login form from one IP within 60 min | source.ip, host | Without a name the login form answers whether an address has an account. Someone is checking a list of addresses against it. The per-IP throttle limits the pace. |

Entity notes:

- `user.name` is the account's e-mail address. App users have no other login name.
- `source.ip` is the real client IP. uvicorn runs with `--proxy-headers` behind the
  BunkerWeb ingress and trusts `X-Forwarded-For` only from private (in-cluster)
  addresses, taking the first address from the right outside those. Entries a client
  adds itself are ignored, so the IP cannot be spoofed.
- `host.name` is the **Kubernetes node** the API pod runs on (`spec.nodeName`, through
  the downward API), not the pod: pod names change on every deploy. It equals the host
  Asset's `name`. If that node runs a Wazuh agent under a different name, tell us and we
  will send that name instead.
- Payloads never contain login codes, bearer tokens or passwords. Invalid tokens are
  counted by a short hash that never leaves the process.

## 3. Mapping, Alert endpoint

- **Collection Root:** `events`
- **Idempotency key:** `event_id`
- **Target fields:**
  - `title` ← `title`
  - `description` ← template: `{{description}}` + blank line + `{{yaml:context}}`
  - `severity` ← `severity` (already in Polaris vocabulary, no translation needed)
  - `tlp` ← `tlp`, `pap` ← `pap` (the app does not send these yet; the mapping is harmless)
- **ECS entities:**
  - `host.name` ← `entities.host.name`
  - `source.ip` ← `entities.source.ip`
  - `user.name` ← `entities.user.name`
  - `file.hash.sha256` ← `entities.file.hash.sha256` (not emitted; the app has no uploads)
  - `process.name` ← `entities.process.name` (not emitted)
- **Source Details:**
  - `rule_id` ← `rule.id`
  - `rule_description` ← `rule.name`
  - `app` ← `app.name`
  - `environment` ← `app.environment`
  - `occurred_at` ← `occurred_at`
- **Occurrence Key (Collapse), suggested:** `source_ref.rule_id`, `entities.user.name`.
  The app runs on a single node, so `entities.host.name` is the same for every event and
  would collapse all occurrences of a rule into one. The account-centric key keeps
  attacks on different accounts apart.

## 4. Mapping, Incident endpoint

Not used (see section 1).

## 5. Mapping, Asset endpoint

- **Collection Root:** `assets`
- **Identity field:** `name`
- `name` ← `name`, `ip_address` ← `ip_address`, `role` ← `role`
- `declared_os_platform` ← `os.platform`, `declared_os_version` ← `os.version`
  (not sent: the container cannot see the node's OS)
- `email` ← `email`, `upn` ← `upn`, `domain_account` ← `domain_account`,
  `username` ← `username`, `object_id` ← `object_id`, `is_privileged` ← `is_privileged`

What is sent:

- **One host:** the Kubernetes node (`name` = node name, `ip_address` = node IP,
  `role` = `server`).
- **Admin users only:** active accounts with `is_staff` or `is_superuser`, with `name`
  (display name), `email`, `object_id` (the account UUID in the app) and
  `is_privileged: true`. Ordinary players are not synced. The app is the identity source
  for these local accounts (no IdP, no SCIM).

## 6. Operational notes

- **Asset sync:** a full snapshot (host + admins) when each API process starts and every
  24 h after that (2 uvicorn workers, so normally two identical snapshots; upsert makes
  that harmless). A change to an account's admin rights is sent right away.
- **Decommissioning:** an admin who loses `is_staff`/`is_superuser`, is deactivated or is
  deleted is sent once more with `is_privileged: false`. The app never sends deletions.
  If the API moves to another node, the old node simply stops being updated; the app
  owner notifies the SOC so the old host can be retired in Polaris.
- **Expected volume (estimate):** low. Detections are aggregated in the app, so expect
  a handful of Alerts per day at most in normal operation, plus 2 small asset snapshots
  per day. Batches are
  flushed every 5 s.
- **Delivery:** in-process background thread per worker, batched, retried with
  exponential backoff and jitter on 429/5xx/network errors using the same `event_id`s.
  The buffer is bounded (2000 per endpoint, lowest severity dropped first) and kept in
  memory, so events still queued during a restart are lost. A 400/404 is logged as an
  error ("Polaris ingest URL rejected the batch…") and the batch is dropped.
- **Thresholds are global:** the counters live in a shared cache in PostgreSQL, the same
  as the app's rate limiting, so they hold across both workers and survive a restart.
- **Silent source:** Polaris does not notice when an ingest source goes quiet. The app
  e-mails its operator (`POLARIS_OPS_EMAIL`) when Polaris rejects a batch (400/404) or
  has been unreachable for 30 min, at most once a day per kind.
- **Secrets:** the URLs are kept in Vault (`kv/puntenteller`) and reach the pod through
  the ExternalSecret `backend-polaris-secret`. They are never in git, and logs show only
  the last 4 characters. To rotate a URL, update Vault; the pod picks it up on its next
  restart.
- **App-side contact:** eddie@vels.online

## 7. Test procedure

One synthetic Alert per `rule.id` (13 in total), with `app.environment: "test"`,
`user.name: polaris-test@example.com` and `source.ip: 203.0.113.10` (TEST-NET-3), and a
title starting with `[TEST]`:

```sh
cd backend
python manage.py polaris_test_events --dry-run   # show the payload only
python manage.py polaris_test_events             # send to POLARIS_ALERT_INGEST_URL
```

Asset endpoint: run this **in the production pod**, so the samples are the real host
and admin accounts (Polaris has no delete, so test assets would stay forever):

```sh
kubectl exec deploy/punten-api -- python manage.py polaris_sync_assets --dry-run
kubectl exec deploy/punten-api -- python manage.py polaris_sync_assets
```

Status:

- [x] Alert endpoint `…621e`: 11 test events sent on 2026-10-17, accepted
      (HTTP 202, `captured_payload` 53440).
- [ ] Two detections added in API v0.6.0 (`abuse.login-code-volume`,
      `account.login-enumeration`): send their test events after the deploy.
- [ ] Asset endpoint `…f440`: snapshot to be sent from the pod after the first deploy
      with this integration.
