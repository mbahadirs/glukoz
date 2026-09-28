# Contributing to Glukoz Panel

Thanks for your interest! Bug reports, fixes, translations, documentation and new data sources are all welcome.
By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ground rules for a health-data project

- **Never share real health data, credentials or tokens** — not in issues, pull requests, logs, screenshots or
  test fixtures. Use mock mode (`LLU_MOCK=true`) and synthetic data. Redact anything you paste.
- **Don't add treatment advice.** No insulin-dose suggestions or anything that could be read as medical
  instructions (see [DISCLAIMER.md](DISCLAIMER.md)). Anything that looks ahead in time must be clearly labelled
  as a mathematical estimate.
- **Be gentle with LibreLinkUp.** Keep the 60-second minimum polling interval and the back-off logic. All
  LibreLinkUp traffic must stay inside `apps/api/src/llu/` (an ESLint rule enforces this).
- **Metrics live in `packages/metrics`** as pure, unit-tested functions. Cite the source of any new clinical
  definition in [docs/metrics.md](docs/metrics.md).

## Development setup

See [README → Local development](README.md#local-development-mock-mode). In short: Node 22, pnpm 9, PostgreSQL 16,
`LLU_MOCK=true`, `pnpm seed:mock`, `pnpm dev`.

## Before opening a pull request

```bash
pnpm lint        # ESLint + Prettier
pnpm typecheck
pnpm test        # needs a database whose name ends in _test (e.g. glukoz_test)
pnpm build
```

For UI changes, also run the end-to-end tests (`pnpm test:e2e`, see `apps/web/playwright.config.ts`) and attach
a screenshot **taken in mock mode**.

- Add or update tests for behaviour changes. Bug fixes should come with a test that fails without the fix.
- Keep user-facing strings in `apps/web/src/i18n/tr.json` **and** `en.json` (a test checks that the keys match).
- Keep request/response types in `packages/shared` so the API and the web app share one contract.
- Every patient-scoped API route must call `requirePatient` (authorisation is checked on every request).
- Store glucose as integer mg/dL and times as UTC in the database.
- Use [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:` …).
- Write new code comments in English (existing comments are mostly Turkish; translations are welcome).

## Reporting bugs

Please include what you expected, what happened, steps to reproduce (ideally in mock mode), versions (browser,
server OS, commit) and relevant log lines **with personal data removed**. If the LibreLinkUp integration broke,
include the error code shown on _Settings → System status_ (for example `LLU_VERSION_TOO_OLD`).

Security issues: **do not open a public issue** — see [SECURITY.md](SECURITY.md).

## Licensing of contributions

This project is licensed under the [GNU AGPL-3.0-or-later](LICENSE). By submitting a contribution you agree
that it is licensed under the same terms, and you confirm that you have the right to submit it (inbound =
outbound). Please don't submit code copied from projects with incompatible licenses; if you adapt code from a
compatible project, keep its copyright notice and mention it in the pull request.
