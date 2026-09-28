# Deployment

Glukoz Panel is a single Node.js process (API, collector, alert engine and the built web app) plus PostgreSQL.
It needs HTTPS in production (secure cookies, Web Push, PWA installation).

> **Run only one instance per LibreLinkUp account.** Two servers polling the same follower account double the
> request rate and risk rate limiting or an account lock. When you move servers, stop the old one first.

## Option 1 — Docker Compose (recommended)

`docker/docker-compose.yml` runs four services:

| Service  | Image                            | Role                                                                                 |
| -------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| `db`     | `postgres:16-alpine`             | Database with a persistent volume and health check                                   |
| `app`    | built from the root `Dockerfile` | API + collector + web app (non-root user, runs migrations on start)                  |
| `caddy`  | `caddy:2-alpine`                 | Reverse proxy with automatic HTTPS (Let's Encrypt), HSTS, compression (SSE excluded) |
| `backup` | `postgres:16-alpine`             | Daily encrypted `pg_dump` to `./backups`, kept for 14 days                           |

```bash
cp .env.example .env         # fill in secrets, DOMAIN, APP_URL, VAPID keys, POSTGRES_PASSWORD, BACKUP_PASSPHRASE
docker compose -f docker/docker-compose.yml --env-file .env up -d --build
docker compose -f docker/docker-compose.yml logs -f app
curl https://<your-domain>/api/health   # → {"ok":true}
```

**Upgrading:** `git pull`, then run the same `up -d --build` command. Database migrations are applied
automatically when the container starts.

### Backups and restore

Backups are encrypted with AES-256 (PBKDF2) using `BACKUP_PASSPHRASE`. Keep the passphrase **and**
`ENCRYPTION_KEY` somewhere safe and separate from the server. To restore:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in backups/glukoz-YYYYMMDDTHHMMSSZ.sql.gz.enc \
  | gunzip | docker compose -f docker/docker-compose.yml exec -T db psql -U glukoz glukoz
```

## Option 2 — Coolify (or similar PaaS)

The repository deploys on [Coolify](https://coolify.io) with the **Dockerfile** build pack:

1. Create a PostgreSQL 16 database resource and note its internal connection URL.
2. Create an application from your Git repository (a read-only deploy key works for private forks), build pack
   _Dockerfile_, port `3000`, and your domain (Coolify's proxy handles HTTPS).
3. Add the environment variables from [configuration.md](configuration.md) — including `DATABASE_URL` pointing
   to the database resource and `NODE_ENV=production`.
4. Health check: path `/api/health`, port `3000`.

Lessons learned:

- **Mark the environment variables as runtime-only** (not "available at build time"). If `NODE_ENV=production`
  is present during `pnpm install`, devDependencies are skipped and the build fails.
- **Use `127.0.0.1` as the health-check host.** Inside the Alpine-based image `localhost` resolves to IPv6 `::1`
  first, while the server listens on IPv4 by default (`HOST=0.0.0.0`), so the check would fail.
- To show your fork's URL in the footer, pass `VITE_SOURCE_URL` as a build argument.

## Option 3 — Node.js without Docker

```bash
pnpm install --frozen-lockfile
pnpm build                                   # builds apps/web/dist and apps/api/dist
cd apps/api && npx prisma migrate deploy     # with DATABASE_URL set
NODE_ENV=production WEB_DIST=../web/dist node --env-file=../../.env dist/server.js
```

Run it under a process manager (systemd, pm2) and put a TLS-terminating reverse proxy in front of it.

## Reverse proxy notes

- **Server-Sent Events:** `/api/stream` must not be buffered or compressed. With nginx:
  `proxy_buffering off; proxy_read_timeout 1h;` for that location. With Caddy: `flush_interval -1` (already in
  `docker/Caddyfile`).
- Forward `X-Forwarded-For` / `X-Forwarded-Proto`; the app trusts the proxy for client IPs (used by login rate
  limiting and the audit log).
- HSTS is sent by the app in production (without `includeSubDomains`); Caddy also adds it.

## Moving data between servers

Use the snapshot tool (`apps/api/src/snapshot.ts`), which works without direct database access to the target:

1. **Stop the old server** so both don't collect at the same time.
2. On the old server: `DATABASE_URL=… node apps/api/dist/snapshot.js export > snapshot.b64`
3. On the new server, set `ENCRYPTION_KEY` to the **same value** as the old one, add `RESTORE_SNAPSHOT_B64` with
   the file's content (runtime variable), and deploy. On start-up the snapshot is imported **only if the target
   has no users**; existing data is never overwritten.
4. Check the logs for `anlık görüntü içe aktarıldı` ("snapshot imported"), then **remove `RESTORE_SNAPSHOT_B64`**.

Users sign in again (sessions are not transferred). The collector back-fills up to 12 hours of readings missed
during the switch.

For large databases, a regular `pg_dump` / `pg_restore` is the better tool.

## Duplicate patient records

If a LibreLinkUp account was added twice, the same patient can appear twice. Setting
`MERGE_DUPLICATE_PATIENTS=true` for one start merges them into the record that last fetched data successfully
(no readings are lost; duplicates at the same timestamp are skipped) and removes the emptied account. Remove the
variable afterwards.
