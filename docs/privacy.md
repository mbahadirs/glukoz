# Operating an instance responsibly (GDPR / KVKK)

Glucose readings are health data — special-category personal data under the EU GDPR (Art. 9) and the Turkish
KVKK (Law No. 6698, Art. 6). **Whoever runs an instance is the data controller** and is responsible for complying
with the law that applies to them. This page lists what the software provides and what remains your job. It is
not legal advice.

## What the software provides

| Need                 | Built-in support                                                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consent              | Versioned consent screen before any patient data is shown (`Consent` table, `CONSENT_VERSION` in `packages/shared`). Bump the version when your notice changes; users must accept again. |
| Information notice   | A Turkish KVKK notice **template** in [kvkk-aydinlatma.md](kvkk-aydinlatma.md), to be completed by you.                                                                                  |
| Access control       | Roles (admin, caregiver, viewer) and per-patient access, checked on every request; access without permission returns 403.                                                                |
| Confidentiality      | LibreLinkUp credentials and tokens encrypted with AES-256-GCM; Argon2id password hashes; HTTPS-only secure cookies in production; strict CSP.                                            |
| Minimisation in logs | Credentials, cookies and e-mail fields are redacted; glucose values are not logged.                                                                                                      |
| Accountability       | Audit log of logins, report views, exports, imports, deletions and account changes.                                                                                                      |
| Retention            | Daily job deletes readings, notes and alert events older than `DATA_RETENTION_DAYS` (default 730).                                                                                       |
| Access / portability | Full CSV export per patient.                                                                                                                                                             |
| Erasure              | Two-step "delete all data of this patient" for administrators; deleting a LibreLinkUp account removes its patients' data.                                                                |
| Shared devices       | The PWA deletes cached health data on sign-out and when the session expires.                                                                                                             |

## Your responsibilities

- **Legal basis and consent:** obtain explicit consent from the people whose data you process (the patient, and
  anyone else you give access to). Complete the notice template with your identity, purposes, retention and
  contact details.
- **Hosting location and transfers:** where your server and backups are located matters. Transfers outside
  Turkey or the EU/EEA have additional conditions (KVKK Art. 9, GDPR Chapter V). Web Push notifications are
  delivered through browser vendors' push services (Google, Mozilla, Apple, Microsoft); only the notification
  text you configure is sent to them.
- **Security of the server:** keep the OS and images updated, restrict SSH, never expose PostgreSQL publicly,
  keep `ENCRYPTION_KEY`, `SESSION_SECRET`, `BACKUP_PASSPHRASE` and VAPID keys secret, and rotate them if leaked.
- **Backups:** encrypted daily backups are part of the Docker Compose setup; store them securely, test restores,
  and include them in your retention policy.
- **Requests from data subjects:** be ready to provide exports and delete data on request.
- **Third-party terms:** LibreLinkUp is used through an unofficial API; check its terms (see
  [librelinkup.md](librelinkup.md) and [DISCLAIMER.md](../DISCLAIMER.md)).
- **Breaches:** have a plan to notify the authority (in Turkey: KVKK Board, within 72 hours) and affected people.

If you offer the panel to people outside your household, or commercially, get proper legal advice first —
including on medical-device regulations.
