# Configuration

The server reads its configuration from environment variables (or a `.env` file in development) and validates
them at start-up with Zod (`apps/api/src/config/env.ts`). If something is missing or invalid, it refuses to start
and prints which variable is wrong. A commented template is in [`.env.example`](../.env.example).

## Required

| Variable         | Description                                                                                                                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string, e.g. `postgresql://glukoz:password@db:5432/glukoz`.                                                                                                                                                         |
| `ENCRYPTION_KEY` | 32 random bytes, base64 (`openssl rand -base64 32`). Encrypts stored LibreLinkUp e-mail, password and tokens with AES-256-GCM. **Back it up.** If it is lost or changed, stored accounts can no longer be decrypted and must be re-added. |
| `SESSION_SECRET` | At least 32 characters (`openssl rand -base64 48`). Used to derive CSRF tokens bound to each session.                                                                                                                                     |

## Server

| Variable              | Default                 | Description                                                                                                                                         |
| --------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`            | `development`           | `production` enables Secure cookies and HSTS.                                                                                                       |
| `APP_URL`             | `http://localhost:3000` | Public URL of the panel.                                                                                                                            |
| `PORT`                | `3000`                  | HTTP port.                                                                                                                                          |
| `HOST`                | `0.0.0.0`               | Bind address. Use `127.0.0.1` to listen on localhost only.                                                                                          |
| `WEB_DIST`            | `../web/dist`           | Directory of the built web app to serve (`/app/web` in the Docker image).                                                                           |
| `LOG_LEVEL`           | `info`                  | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`. Credentials, cookies and e-mail fields are redacted; glucose values are not logged. |
| `DEFAULT_TIMEZONE`    | `Europe/Istanbul`       | Time zone for newly discovered patients (editable per patient).                                                                                     |
| `DATA_RETENTION_DAYS` | `730`                   | Readings, notes and alert events older than this are deleted daily (minimum 30).                                                                    |

## LibreLinkUp

See [librelinkup.md](librelinkup.md) before changing these.

| Variable            | Default       | Description                                                                                                                                                                        |
| ------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LLU_PRODUCT`       | `llu.android` | Value of the `product` request header.                                                                                                                                             |
| `LLU_VERSION`       | `4.16.0`      | Value of the `version` header. If LibreLinkUp answers "version too old" (status 920), the client retries once with the required version and stores it; you can also raise it here. |
| `LLU_POLL_SECONDS`  | `60`          | How often current values are fetched. **Cannot go below 60** — enforced in code.                                                                                                   |
| `LLU_GRAPH_MINUTES` | `15`          | How often the 12-hour history is fetched to fill gaps.                                                                                                                             |
| `LLU_LOGBOOK_HOURS` | `6`           | How often the logbook (scans, alarms) is fetched.                                                                                                                                  |
| `LLU_MOCK`          | `false`       | `true` uses synthetic data and never contacts LibreLinkUp (development and demos).                                                                                                 |
| `LLU_MOCK_FAIL`     | `none`        | Mock mode only: simulate `401`, `429`, `920` or `network` errors.                                                                                                                  |
| `COLLECTOR_ENABLED` | `true`        | `false` disables background collection (e.g. for a read-only replica).                                                                                                             |

## Notifications

| Variable                                 | Default                    | Description                                                                                       |
| ---------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------- |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | empty                      | Web Push keys (`npx web-push generate-vapid-keys`). Without them push notifications are disabled. |
| `VAPID_SUBJECT`                          | `mailto:admin@example.com` | Contact URL or `mailto:` sent to push services.                                                   |
| `ALERT_NOTIFY_RESOLVED`                  | `true`                     | Send a "back to normal" notification after low/high alerts resolve.                               |

## Web app (build time)

| Variable          | Default         | Description                                                                                                                                                       |
| ----------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SOURCE_URL` | this repository | "Source code" link in the footer. **If you run a modified version publicly, set this to your fork** (AGPL-3.0 §13). With Docker: `--build-arg VITE_SOURCE_URL=…`. |

## Maintenance (one-off)

| Variable                   | Description                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RESTORE_SNAPSHOT_B64`     | Restore a snapshot on start-up into an **empty** database. Remove it afterwards. See [deployment.md](deployment.md#moving-data-between-servers). |
| `MERGE_DUPLICATE_PATIENTS` | `true` merges duplicate records of the same LibreLinkUp patient on start-up. Remove it afterwards.                                               |
| `REPORT_PDF_SERVER`        | Reserved for a future server-side PDF renderer; currently unused.                                                                                |

## Tests

| Variable                   | Description                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TEST_DATABASE_URL`        | Database for the API test suite. Its name **must end in `_test`**; tests truncate its tables. Defaults to `postgresql://$USER@localhost:5432/glukoz_test`. |
| `E2E_BASE_URL` / `API_URL` | Base URL for Playwright tests / Vite dev proxy target (default `http://localhost:3300`).                                                                   |

## Docker Compose

`docker/docker-compose.yml` additionally uses `POSTGRES_PASSWORD`, `BACKUP_PASSPHRASE` (encrypts daily backups)
and `DOMAIN` (for Caddy's automatic HTTPS).
