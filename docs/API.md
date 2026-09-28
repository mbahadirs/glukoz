# REST API reference

Types live in `packages/shared/src/api-types.ts`; request schemas (Zod) in `packages/shared/src/schemas.ts`.
The web app and the API share this contract.

## Conventions

- All endpoints are under `/api` and exchange JSON. Times are ISO 8601 UTC strings; chart series are
  `[epochMs, mgdl]` pairs. Glucose is always mg/dL on the wire.
- Error body: `{ "error": { "code": "…", "message": "…" } }`. Codes: `UNAUTHORIZED` 401, `FORBIDDEN` 403,
  `CONSENT_REQUIRED` 403, `CSRF` 403, `NOT_FOUND` 404, `VALIDATION` 400, `CONFLICT` 409, `RATE_LIMITED` 429,
  `LLU_*` (LibreLinkUp errors) 400/502. Messages are currently Turkish.
- **Session:** `glk_sid` httpOnly cookie (SameSite=Lax, Secure in production), 14-day sliding expiry.
- **CSRF (double submit):** readable `glk_csrf` cookie and `MeResponse.csrfToken`. Every non-GET request must
  send the `x-csrf-token` header (except `/api/auth/login` and `/api/setup`).
- **Consent:** until the current `requiredConsentVersion` is accepted, patient-data endpoints return
  `CONSENT_REQUIRED`.
- **Authorisation:** every patient-scoped endpoint checks the caller's access to that patient on each request.

## Endpoints

| Method       | Path                                                    | Response                                                                              |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| GET          | `/api/setup/status`                                     | `SetupStatusResponse`                                                                 |
| POST         | `/api/setup`                                            | `MeResponse` (first ADMIN; 409 afterwards)                                            |
| POST         | `/api/auth/login`                                       | `MeResponse`                                                                          |
| POST         | `/api/auth/logout`                                      | 204                                                                                   |
| GET          | `/api/auth/me`                                          | `MeResponse`                                                                          |
| PATCH        | `/api/me/preferences`                                   | `MeResponse`                                                                          |
| POST         | `/api/me/consent`                                       | `MeResponse`                                                                          |
| GET/POST     | `/api/admin/users`                                      | `AdminUserDto[]` / `AdminUserDto`                                                     |
| PATCH/DELETE | `/api/admin/users/:id`                                  | `AdminUserDto` / 204                                                                  |
| GET/POST     | `/api/llu-accounts`                                     | `LluAccountDto[]` / `LluAccountCreateResponse`                                        |
| POST         | `/api/llu-accounts/:id/test`                            | `LluAccountTestResponse`                                                              |
| POST         | `/api/llu-accounts/:id/resume`                          | `LluAccountDto`                                                                       |
| DELETE       | `/api/llu-accounts/:id`                                 | body `{ confirmLabel }` → 204                                                         |
| GET          | `/api/patients`                                         | `PatientSummary[]`                                                                    |
| PATCH        | `/api/patients/:id`                                     | `PatientSummary`                                                                      |
| GET          | `/api/patients/:id/current`                             | `CurrentResponse`                                                                     |
| GET          | `/api/patients/:id/readings?from&to&resolution=raw\|5m` | `ReadingsResponse`                                                                    |
| GET          | `/api/patients/:id/day?date=YYYY-MM-DD`                 | `DayResponse`                                                                         |
| GET          | `/api/patients/:id/report?from&to`                      | `ReportResponse` (includes `daily[].slots`)                                           |
| GET          | `/api/patients/:id/report/compare?from&to`              | `ReportComparison`                                                                    |
| GET          | `/api/patients/:id/events?from&to&type`                 | `GlycemicEvent[]`                                                                     |
| GET          | `/api/patients/:id/sensors`                             | `SensorHistoryDto[]`                                                                  |
| GET          | `/api/patients/:id/logbook?from&to`                     | `LogbookEntryDto[]`                                                                   |
| GET/POST     | `/api/patients/:id/notes?from&to`                       | `NoteDto[]` / `NoteDto`                                                               |
| PATCH/DELETE | `/api/patients/:id/notes/:noteId`                       | `NoteDto` / 204                                                                       |
| GET          | `/api/patients/:id/export.csv?from&to`                  | `text/csv` (UTF-8 BOM, `;` separator)                                                 |
| POST         | `/api/patients/:id/import/libreview-csv`                | multipart `file` → `ImportResponse`                                                   |
| DELETE       | `/api/patients/:id/data`                                | step 1: `{}` → `DeleteDataStep1Response`; step 2: `{confirmToken, confirmName}` → 204 |
| GET/PUT      | `/api/patients/:id/alert-rules`                         | `AlertRuleDto[]` (PUT body `{ rules }`)                                               |
| GET          | `/api/patients/:id/alerts?limit=`                       | `AlertEventDto[]`                                                                     |
| GET          | `/api/alerts/active`                                    | `AlertEventDto[]` (last 24 h, unacknowledged)                                         |
| POST         | `/api/alerts/:id/ack`                                   | `AlertEventDto`                                                                       |
| GET          | `/api/stream?patientId=`                                | SSE: `reading`, `alert`, `status`, `ping` (every 25 s)                                |
| GET          | `/api/push/vapid-public-key`                            | `{ key: string \| null }`                                                             |
| POST/DELETE  | `/api/push/subscribe`                                   | 204                                                                                   |
| POST         | `/api/push/test`                                        | `{ sent: number }`                                                                    |
| GET          | `/api/health`                                           | `{ ok: true }`                                                                        |
| GET          | `/api/system/status`                                    | `SystemStatusResponse` (admin only)                                                   |

`from`/`to` accept an ISO date-time or epoch milliseconds; ranges are half-open `[from, to)`.
