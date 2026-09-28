# Glukoz Panel

**A self-hosted glucose dashboard for FreeStyle Libre data via LibreLinkUp** — live values, daily view, CGM
consensus reports (AGP, time in ranges, GMI, CV, GRI) and alerts, as an installable web app (PWA).

🇹🇷 **[Türkçe README için tıklayın](README.tr.md)**

[![License: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue.svg)](LICENSE)
![Node 22](https://img.shields.io/badge/node-22-green.svg)
![Status: community project](https://img.shields.io/badge/status-community%20project-orange.svg)

> [!WARNING]
> **Not a medical device. Do not use it for treatment decisions.** Values can be delayed or missing, and alerts
> may never arrive — keep using your official CGM app and its alarms.
> This project uses an **unofficial, undocumented LibreLinkUp API** that can break at any time and may conflict
> with the service's terms of use. It is **not affiliated with Abbott**. Read the full **[DISCLAIMER](DISCLAIMER.md)**.

| Live view                                                                         | Reports                                                                           | Mobile (dark)                                                          |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| ![Live view with chart, projection and quick entry](docs/images/live-desktop.png) | ![14-day report with summary and time in ranges](docs/images/reports-desktop.png) | ![Live view on a phone in dark mode](docs/images/live-mobile-dark.png) |

_Screenshots use synthetic data from the built-in mock mode._

## Features

- **Live view** — current value, trend arrow, 5-minute delta, data age with "data delayed" warning; 3/6/12/24 h
  chart with target band, threshold lines and event markers; updates in real time (Server-Sent Events).
- **Trend tools** — tap two readings to see change and rate between them; optional short linear projection with
  an uncertainty band (clearly labelled as a mathematical extrapolation).
- **Quick entries** — insulin, meals, water, sleep and more, "now" or at a chosen time; shown as markers on charts.
- **Daily view** — 24 h curve, events, notes, compare with another day.
- **Reports** (7/14/30/90 days or custom) following international CGM consensus: summary with period-over-period
  comparison, time in ranges, **AGP**, daily small multiples, hypo/hyper events, time-of-day and weekday analysis,
  hour × day heatmap, post-meal analysis, GRI grid, LBGI/HBGI. **PDF** (print) and **CSV** export.
- **Alerts** — urgent low, low, high, rapid fall/rise, stale data, sensor ending; cooldowns and quiet hours;
  Web Push notifications.
- **Multi-user & multi-patient** — roles (admin, caregiver, viewer), per-patient access, audit log.
- **Privacy tooling** — encrypted LibreLinkUp credentials (AES-256-GCM), consent tracking, data retention job,
  full export and two-step deletion (built with GDPR / Turkish KVKK in mind).
- **PWA** — installable, works offline with the last known data, light/dark themes, mg/dL ↔ mmol/L,
  Turkish (default) and English UI.
- **Mock mode** — realistic synthetic data for development and demos, no real account needed.
- **LibreView CSV import** for history older than what LibreLinkUp returns.

## How it works

```
FreeStyle Libre sensor ─BLE─▶ LibreLink app (patient's phone) ─▶ LibreView cloud
                                                                     │  LibreLinkUp (unofficial API)
                                                                     ▼
┌──────────────────────────── your server ────────────────────────────┐
│  Collector (every 60 s) ─▶ PostgreSQL ◀─ REST API ── SSE / Web Push │
│  Alert engine                                  │                    │
└────────────────────────────────────────────────┼────────────────────┘
                                                 ▼
                                   PWA (React) in any browser
```

You need a **separate LibreLinkUp follower account** that the patient has invited from their LibreLink app —
logging in with the patient's own LibreLink account returns no connections. See
[docs/librelinkup.md](docs/librelinkup.md).

## Quick start (Docker Compose)

Requirements: a Linux server (1 vCPU / 1 GB RAM is enough), Docker with Compose, a domain name pointing to the
server, ports 80/443 open.

```bash
git clone https://github.com/mbahadirs/glukoz.git && cd glukoz
cp .env.example .env
# Fill in .env — at minimum:
#   openssl rand -base64 32   → ENCRYPTION_KEY   (keep it safe!)
#   openssl rand -base64 48   → SESSION_SECRET
#   openssl rand -base64 24   → POSTGRES_PASSWORD
#   openssl rand -base64 32   → BACKUP_PASSPHRASE
#   npx web-push generate-vapid-keys → VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
#   DOMAIN, APP_URL, VAPID_SUBJECT
docker compose -f docker/docker-compose.yml --env-file .env up -d --build
```

Open `https://<your-domain>/`: the first-run page creates the administrator. Then go to **Settings →
LibreLinkUp accounts → Add account**. Caddy obtains the TLS certificate automatically.

Other options (Coolify, bare Node.js, backups, migrating data between servers): [docs/deployment.md](docs/deployment.md).

## Local development (mock mode)

Requirements: Node.js 22, pnpm 9, PostgreSQL 16.

```bash
pnpm install
createdb glukoz && createdb glukoz_test
cp .env.example .env    # set NODE_ENV=development, LLU_MOCK=true, PORT=3300, DATABASE_URL, ENCRYPTION_KEY, SESSION_SECRET
pnpm db:migrate
pnpm seed:mock          # two synthetic patients, 90 days of data
pnpm dev                # API on :3300, web on :5173 (proxies /api)
```

| Command                                       | What it does                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm test`                                   | Unit + integration tests (the API suite needs a database whose name ends in `_test`) |
| `pnpm test:e2e`                               | Playwright end-to-end tests against a built server in mock mode                      |
| `pnpm lint` · `pnpm typecheck` · `pnpm build` | Quality gates used by CI                                                             |

## Documentation

| Document                                       | Contents                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| [DISCLAIMER.md](DISCLAIMER.md)                 | Medical, legal, trademark and privacy disclaimers — **read first**      |
| [docs/architecture.md](docs/architecture.md)   | Components, repository layout, data flow                                |
| [docs/configuration.md](docs/configuration.md) | All environment variables                                               |
| [docs/deployment.md](docs/deployment.md)       | Docker Compose, Coolify, reverse proxies, backups, data migration       |
| [docs/librelinkup.md](docs/librelinkup.md)     | Follower account setup, how the unofficial API is used, troubleshooting |
| [docs/metrics.md](docs/metrics.md)             | Metric definitions, formulas and clinical references                    |
| [docs/API.md](docs/API.md)                     | REST API reference                                                      |
| [docs/privacy.md](docs/privacy.md)             | Operating an instance responsibly (GDPR / KVKK)                         |
| [docs/DECISIONS.md](docs/DECISIONS.md)         | Design decisions and trade-offs                                         |
| [docs/spec/SPEC.tr.md](docs/spec/SPEC.tr.md)   | Original product specification (Turkish)                                |

## Project status and known limitations

- A community project maintained on a best-effort basis. The LibreLinkUp integration can break whenever the
  vendor changes its API.
- The UI ships in **Turkish (default) and English**. Some server-generated texts (e.g. alert messages) are
  currently Turkish only. Source code comments are mostly in Turkish — translations are welcome.
- Web Push requires HTTPS; on iOS it only works when the app is added to the home screen (iOS 16.4+).
- Only LibreLinkUp is supported as a data source today; the code has a `GlucoseSource` abstraction for others
  (e.g. Nightscout) — contributions welcome.
- Native mobile / smartwatch apps are not part of this repository.

## Contributing

Contributions are welcome — please read [CONTRIBUTING.md](CONTRIBUTING.md) and our
[Code of Conduct](CODE_OF_CONDUCT.md). Never include real health data, credentials or tokens in issues, pull
requests, screenshots or test fixtures.

Found a security issue? Please report it privately — see [SECURITY.md](SECURITY.md).

## Acknowledgments

This project would not exist without the diabetes open-source community (#WeAreNotWaiting) — in particular
the people who documented the LibreLinkUp API — and the authors of the clinical consensus the reports are based
on. See **[ACKNOWLEDGMENTS.md](ACKNOWLEDGMENTS.md)** and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

Copyright © 2026 [@mbahadirs](https://github.com/mbahadirs) and contributors.

Glukoz Panel is free software: you can redistribute it and/or modify it under the terms of the
**GNU Affero General Public License v3.0 or later** — see [LICENSE](LICENSE). If you run a modified version as a
network service, the AGPL requires you to offer its source code to your users; the web UI has a configurable
"Source code" link for this (`VITE_SOURCE_URL`).

FreeStyle Libre, LibreLink, LibreLinkUp and LibreView are trademarks of Abbott. This project is not affiliated
with Abbott.
