# Architecture

## Components

```
┌──────────────────────── Node.js process (apps/api) ─────────────────────────┐
│  Collector ── LibreLinkUp client (src/llu, the ONLY place that talks to LLU) │
│     │ every 60 s: connections → upsert readings → alert engine → SSE        │
│     ▼                                                                        │
│  PostgreSQL (Prisma) ◀── REST API (Fastify, Zod) ── SSE (/api/stream)        │
│  Alert engine ── Web Push (VAPID)        Retention job (daily)              │
│  Static file server for the built PWA (apps/web/dist)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS (same origin)
                    PWA: React 19 + Vite, TanStack Router/Query, ECharts, Workbox
```

- The browser never talks to LibreLinkUp (CORS and credential safety). All vendor traffic is on the server.
- The collector and API run in one process but are separate modules; the data source sits behind a
  `GlucoseSource` interface so other sources (e.g. Nightscout) can be added.
- Reports are computed on the server with `packages/metrics` and cached in memory for 5 minutes, keyed by
  patient, range and the latest reading.
- Live updates use Server-Sent Events; the web app falls back to polling every 60 s if the stream drops.
- The service worker precaches the app shell and caches `current`, `day` and `report` responses (network-first,
  5-second timeout) for offline viewing. Authentication and non-GET requests are never cached.

## Repository layout

```
apps/
  api/                 Fastify server
    prisma/            schema.prisma and migrations
    src/llu/           LibreLinkUp client, parsing, mock client and synthetic data
    src/sources/       GlucoseSource interface + LibreLinkUp adapter
    src/collector/     polling loop, de-duplication, back-fill, locking, back-off
    src/alerts/        rule evaluation (pure) and Web Push delivery
    src/auth/          sessions, CSRF, guards (requirePatient)
    src/routes/        REST endpoints
    src/services/      report cache, current value, patient summaries
    src/import/        CSV parsing (LibreView import) and CSV export helpers
    src/jobs/          retention, duplicate-patient merge
    src/snapshot.ts    export/restore snapshots for moving between servers
    test/              Vitest (unit, MSW-based client tests, DB integration tests)
  web/                 React PWA
    src/routes/        pages (live, daily, reports + print, records, sensors, alerts, settings)
    src/components/    charts (ECharts), dialogs, layout
    src/i18n/          tr.json (default) and en.json
    src/sw.ts          service worker (Workbox + push)
    tests/             Vitest unit tests and Playwright e2e tests
packages/
  metrics/             pure CGM metric functions (≈100 % line coverage)
  shared/              API types, Zod request schemas, constants shared by API and web
docker/                Compose file, Caddyfile, backup script
docs/                  documentation (this folder)
```

## Data model (simplified)

`User` —< `PatientAccess` >— `Patient` >— `LluAccount`
`Patient` —< `Reading` (unique per timestamp, source-ranked), `Sensor`, `Note`, `LogbookEntry`, `AlertRule`,
`AlertEvent`. Plus `Session`, `Consent`, `PushSubscription`, `CollectorRun`, `AuditLog`, `Setting`.
Glucose is stored as integer mg/dL, timestamps as UTC (`timestamptz`).

See [DECISIONS.md](DECISIONS.md) for the reasoning behind many of these choices and [API.md](API.md) for the
HTTP interface.
