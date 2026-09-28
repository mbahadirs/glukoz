# LibreLinkUp integration

> LibreLinkUp's API is **unofficial and undocumented**. It can change without notice, and using it may conflict
> with the service's terms of use. Use it only with accounts you own or are authorised to use. See
> [DISCLAIMER.md](../DISCLAIMER.md). What is known about the API comes from the community — see
> [ACKNOWLEDGMENTS.md](../ACKNOWLEDGMENTS.md).

## Data flow

```
Sensor ─BLE─▶ FreeStyle LibreLink app (patient's phone) ─▶ LibreView cloud ─▶ LibreLinkUp follower account ─▶ Glukoz Panel
```

The panel logs in as a **LibreLinkUp follower**, not as the patient. Logging in with the patient's own LibreLink
account returns an empty connection list.

## Setting up a follower account

1. Create a LibreLinkUp account for the follower (a separate e-mail address) in the **LibreLinkUp** mobile app.
2. In the patient's **FreeStyle LibreLink** app, open the connected-apps / sharing menu, choose **LibreLinkUp**
   and invite the follower's e-mail address.
3. In the LibreLinkUp app, the follower **accepts the invitation** and accepts any pending terms of use or
   privacy notices. (Pending acceptances make the API return status 4 until they are accepted in the app.)
4. In the panel: **Settings → LibreLinkUp accounts → Add account** with the follower's e-mail and password. The
   panel tests the login, lists the patients it finds, and immediately back-fills the last 12 hours.

Credentials and session tokens are stored encrypted (AES-256-GCM with `ENCRYPTION_KEY`) and are never logged.

## What the collector does

All LibreLinkUp traffic is isolated in `apps/api/src/llu/` so that API changes only need to be fixed in one
place.

| Request                             | Frequency                                           | Purpose                                                                    |
| ----------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| `POST /llu/auth/login`              | only when needed (renewed one day before expiry)    | Session token, user id, region redirect                                    |
| `GET /llu/connections`              | every 60 s (± 5 s jitter)                           | Latest reading, trend arrow, targets and sensor for every followed patient |
| `GET /llu/connections/{id}/graph`   | every 15 min, at start-up, and after a gap > 15 min | About 12 hours of history (15-minute values)                               |
| `GET /llu/connections/{id}/logbook` | every 6 hours                                       | Scans and alarm events                                                     |

Behaviour worth knowing:

- **Headers:** `product` and `version` (configurable via `LLU_PRODUCT` / `LLU_VERSION`) on all requests;
  `Authorization: Bearer <token>` and `Account-Id: <sha256 of the user id>` on authenticated requests.
- **Regions:** the global host may answer with a redirect to a regional host (e.g. `eu`); this is followed both at
  login and on data requests, and the region is saved.
- **Version too old (status 920):** the client retries once with the `minimumVersion` from the response and
  stores it; the administrator is notified.
- **Timestamps:** `FactoryTimestamp` (UTC, US format with AM/PM) is authoritative; the device-local `Timestamp`
  is kept for information only. `ValueInMgPerDl` is used; the colour and high/low flags from the API are ignored.
- **Duplicates:** readings are unique per patient and timestamp; sources are ranked `current > graph > logbook >
import`, and near-duplicates within ± 30 s with the same value are skipped.
- **Errors and back-off:** 429 and network errors back off exponentially (1 → 2 → 4 … up to 30 minutes; at least
  5 minutes after a 429). Bad credentials or a required action in the app pause the account immediately; other
  authentication failures pause it after three attempts. Resume it from _Settings_ after fixing the cause.
- **Minimum interval:** polling can never be configured below 60 seconds.

## How fresh is the data?

- **Current values** change as often as the patient's phone uploads to LibreView — typically about once a minute
  while the LibreLink app is running, but less often if the phone is offline, in battery-saving mode, or the
  sensor loses its Bluetooth connection. The live view shows the actual data frequency.
- **History** from the `graph` endpoint has 15-minute resolution and covers roughly 12 hours; longer outages cannot
  be back-filled from LibreLinkUp. Import a LibreView CSV export (_Settings → CSV import_) to fill older gaps.

## Troubleshooting

The last error of each account is shown under _Settings → System status_.

| Symptom / code                               | Likely cause                                                                   | What to do                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `LLU_VERSION_TOO_OLD` (HTTP 403, status 920) | The `version` header is below LibreLinkUp's minimum                            | Usually fixed automatically; otherwise raise `LLU_VERSION` to the `minimumVersion` shown                   |
| HTTP 400 `RequiredHeaderMissing`             | `Account-Id` header missing                                                    | Make sure you run a current version; report it if it persists                                              |
| `LLU_BAD_CREDENTIALS` (status 2)             | Wrong e-mail or password                                                       | Check them in the LibreLinkUp app, fix, then _Resume_ the account                                          |
| `LLU_ACTION_REQUIRED` (status 4)             | Terms of use / privacy notice waiting for acceptance                           | Open the LibreLinkUp app, accept, then _Resume_                                                            |
| `LLU_NO_CONNECTIONS` / empty patient list    | The patient's own account was used, or the invitation is not accepted          | Use a separate follower account and accept the invitation                                                  |
| `LLU_RATE_LIMITED` (HTTP 429)                | Too many requests or failed logins                                             | Wait for the back-off; don't run two servers against one account                                           |
| `LLU_BAD_RESPONSE`                           | The API returned something unexpected                                          | Check _System status_ for details; the API may have changed — please open an issue (without personal data) |
| Data more than 15 minutes old                | Patient's phone offline, LibreLink closed or battery-optimised, Bluetooth loss | Check the patient's phone; disable battery optimisation for LibreLink                                      |
| Gaps in the curve                            | Phone–sensor distance, Bluetooth interruptions                                 | Up to 12 hours are back-filled automatically; import a LibreView CSV for older gaps                        |

## Developing without a real account

Set `LLU_MOCK=true`. The mock client implements the same interface with two synthetic patients (meal peaks,
night dip, occasional hypos and data gaps, a sensor about to expire) and can simulate failures with
`LLU_MOCK_FAIL=401|429|920|network`. `pnpm seed:mock` loads 90 days of history. The client's behaviour against the
real API is covered by MSW-based tests with recorded, anonymised response shapes (`apps/api/test/fixtures/llu`).
