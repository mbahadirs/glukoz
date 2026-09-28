# Design decisions

Points where the [original specification](spec/SPEC.tr.md) was ambiguous, or where the implementation
deliberately differs from it. When in doubt, the simplest safe option was chosen.

## Stack and versions

- **Pinned major versions:** zod 3, Prisma 6, Vite 6, Vitest 3, ECharts 5, TypeScript 5.9, i18next 25. Newer
  majors (zod 4, Prisma 7, Vite 8) have breaking API changes; well-known stable versions were preferred.
- **Node 22** (`.nvmrc`, `engines`). Workspace packages (`@glukoz/shared`, `@glukoz/metrics`) are consumed as
  TypeScript source; the API is bundled into a single file with esbuild for production (`apps/api/build.mjs`).
- **Routing:** TanStack Router with code-based routes (no file-based plugin).
- Local development uses port 3300 for the API (to avoid clashing with other tools on 3000); the Docker image
  listens on 3000.

## Schema additions

- `User.theme` (system/light/dark) — theme preference is stored server-side.
- `LogbookEntry` table — keeps the LibreLinkUp logbook `alarmType`. Scan and alarm values are also written to
  `readings` with `source='logbook'`.
- `AlertRule @@unique([patientId, kind])` — one rule per kind and patient; `PUT` updates by kind.
- Tables are mapped to snake_case plural names (`readings`, `collector_runs`, …).
- `Session.id` stores the **SHA-256** of the 256-bit cookie value; the raw session id is never stored.
- `NoteType.water` and `Note.waterMl` for water intake entries (additive migration).

## Collector

- **Pausing accounts:** `LLU_BAD_CREDENTIALS` and `LLU_ACTION_REQUIRED` pause the account **immediately**
  (retrying could lock the account). Other auth errors (401/403) pause it after 3 consecutive failures. Network
  errors and 429 do not pause; exponential back-off applies (for 429: at least 5 minutes or `Retry-After`).
- **Jitter** is applied to the schedule (each cycle and graph/logbook times ±5 s); no per-request sleeps.
- **Advisory lock** at transaction level (`pg_try_advisory_xact_lock`), because session-level locks are
  unreliable with Prisma's connection pool.
- **Region redirects** are followed both at login and on data requests (`{status: 0, data: {redirect, region}}`);
  the region is persisted with the session. Unknown region codes are tried as `api-<region>.libreview.io`; the
  code is restricted to `[a-z0-9]{2,5}`, so requests can only go to `libreview.io` subdomains.
- **Error envelopes:** a JSON response with `status ≠ 0` triggers one re-login and retry (e.g. a token issued to
  another environment); if it persists, the LibreLinkUp status code and message are reported.
- The LibreLinkUp session is renewed one day before it expires; the token is stored encrypted.
- Minimum polling interval is **60 s**, enforced in code regardless of configuration.

## Metrics

- **Event detection** works on 5-minute slots; a data gap longer than 20 minutes ends a running event. Level-1
  and level-2 hypoglycaemia are counted as separate events (a level-2 period is also part of a level-1 event).
  "Prolonged hypo" means level 2 for ≥ 120 minutes.
- **Period comparison:** mean glucose and GMI are shown as "neutral" (a decrease may also come from more hypos);
  higher is better for TIR, TITR and data sufficiency; lower is better for TBR, TAR, CV, GRI and hypo count.
- **AGP smoothing:** empty neighbouring buckets are excluded from the moving average; buckets with fewer than 5
  values are not drawn. The chart uses a category axis (96 × 15-minute buckets) because ECharts only stacks band
  areas reliably on category axes.
- **Meal type** from local time: breakfast 05–11, lunch 11–16, dinner 16–22, otherwise snack.
- **Live delta** = latest value − the closest value 3–8 minutes earlier.
- **Chart resolution:** live and daily charts draw **raw readings** (as often as LibreLinkUp provides them —
  about every minute for current values, every 15 minutes for history). Report metrics still use 5-minute slots.

## Projection and trend tools (deliberate deviation from the spec)

The specification (section 8.7) said not to show projections on the live screen, because they could lead to
treatment decisions. They were added later at the author's explicit request, with safeguards:

- They can be switched off ("Show projection"; the choice is stored in the browser).
- A permanent disclaimer and a "mathematical (linear)" label are shown.
- An uncertainty band is always drawn; the horizon is limited to 30 minutes.
- No projection without at least 3 readings in the last 20 minutes and a value newer than 10 minutes.

**Method** (`packages/metrics/src/projection.ts`): least-squares line over the last 20 minutes. The band is
`max(t₀.₉₇₅(n−2) · prediction standard error, 4 + 0.35 · minutes)`. The lower bound is a heuristic that keeps
the band from looking misleadingly narrow when there are few, smooth readings (CGM measurement error and
physiological variability). Values are clamped to 40–400 mg/dL.

**Trend between two points:** the user taps two readings; the change, duration and average rate are shown and
the slope is extended 30 minutes with a dotted line. A tap snaps to the nearest reading within 28 px; a third tap
starts a new selection.

## Alerts

- During quiet hours events are recorded but no push is sent (`urgent_low` is never silenced).
- "Resolved" notifications for `urgent_low/low/high` when `ALERT_NOTIFY_RESOLVED=true` (default). State is kept in
  memory; the first evaluation after a restart does not send "resolved".
- `stale` threshold is `sustainMin` (default 20 min); `sensor_ending` threshold is `sustainMin` (1440 min) with a
  1440-minute cooldown.
- Administrators can access all patients and receive notifications for all of them.
- Push subscription endpoints are restricted to known push services (FCM, Mozilla, Apple, WNS) to prevent SSRF.
- Alert message texts are generated server-side and are currently Turkish only.

## Security and privacy

- Without access to a patient the API returns **403** whether or not the patient exists (no existence leak).
- Read-only access (`canEdit=false`) and the VIEWER role cannot add notes, change settings or rules, or
  acknowledge alerts.
- Until the current consent version is accepted, patient-data endpoints return `CONSENT_REQUIRED`.
- **Data deletion** (`DELETE /patients/:id/data`) is admin-only and removes readings, notes, logbook entries,
  sensors and alert events. If the patient keeps sharing via LibreLinkUp, collection continues; to stop it,
  delete the LibreLinkUp account in the panel or stop sharing in the patient's app.
- On sign-out and when the session expires, the PWA deletes its cached health data (`api-data` cache).
- Free-text error messages (`lastError`) are scrubbed of e-mail addresses and token-like strings before storage.
- Concurrent `/setup` requests are protected by a serializable transaction; a conflict returns 409.

## Export and import

- **CSV export:** readings and notes in one file, distinguished by the `kayit` column; UTF-8 BOM and `;`
  separator (for spreadsheet software in Turkish locales); text starting with `=`, `+`, `-` or `@` is prefixed
  with `'` against CSV injection.
- **PDF:** no headless browser on the server; the print route (`/raporlar/yazdir`) calls `window.print()`.
  `REPORT_PDF_SERVER` is a placeholder for a possible server-side renderer.
- **LibreView CSV import:** if the date format is ambiguous (MM-DD vs DD-MM), the format that yields the most
  consistent time series is chosen.

## Maintenance tools

- **Snapshots** (`apps/api/src/snapshot.ts`): export a gzip+base64 JSON snapshot of the database and restore it
  on another server through the `RESTORE_SNAPSHOT_B64` environment variable. Restore only runs when the target
  has no users, never overwrites data, and does not transfer sessions or push subscriptions. The same
  `ENCRYPTION_KEY` is required on the target.
- **Duplicate patients** (`apps/api/src/jobs/merge-duplicates.ts`): with `MERGE_DUPLICATE_PATIENTS=true`, records
  of the same LibreLinkUp patient under several accounts are merged at start-up into the one that last fetched
  data successfully; the emptied account is removed.

## Tests

- The API test suite only runs against a database whose name ends in `_test`; it applies migrations
  (`prisma migrate deploy`) and truncates tables between tests. It never runs `migrate reset`.
- End-to-end tests run two Playwright projects (mobile and desktop) sequentially with one worker and reuse the
  session cookie per project (login is rate-limited to 5 per minute per IP).
