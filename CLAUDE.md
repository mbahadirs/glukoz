# CLAUDE.md — guidance for AI coding assistants

Also useful for human contributors; see [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.
Specification: `docs/spec/SPEC.tr.md` (Turkish). Decisions: `docs/DECISIONS.md`. API contract: `docs/API.md` +
`packages/shared`.

## Commands (pnpm, Node 22)

- `pnpm dev` — API (3300, `.env`) + web (5173, proxies `/api`)
- `pnpm test` — unit/integration tests (API tests need a database named `*_test`)
- `pnpm test:e2e` — Playwright (a built server must be running in mock mode)
- `pnpm lint` · `pnpm typecheck` · `pnpm build`
- `pnpm seed:mock` — 90 days of synthetic data · `pnpm db:migrate` — Prisma migration

## Rules

- Everything LibreLinkUp-related stays in `apps/api/src/llu/`; nothing else calls LibreLinkUp (an ESLint rule
  enforces it). Never lower the 60-second minimum polling interval.
- Metric calculations live only in `packages/metrics` as pure functions; the web app does not compute report
  metrics (exceptions: unit conversion, chart gap breaking, interactive trend tools).
- Glucose is always stored as integer mg/dL, time always as UTC.
- Develop with `LLU_MOCK=true`; test against real accounts only manually and briefly.
- Never log or commit personal/health data, tokens or passwords; never put real data in test fixtures.
- User-facing strings go into `apps/web/src/i18n/tr.json` and `en.json` (Turkish is the default).
- Every patient-scoped endpoint must authorise with `requirePatient`.
- Request/response types live in `packages/shared`; the API and web share one contract.
- No treatment advice; anything forward-looking must be labelled as a mathematical estimate.
