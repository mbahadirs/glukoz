# Security policy

Glukoz Panel processes health data and stores third-party credentials, so we take security reports seriously.

## Reporting a vulnerability

**Please do not report security issues in public issues, discussions or pull requests.**

Use GitHub's private reporting instead: **Security → Report a vulnerability** on this repository
([privately reporting a security vulnerability](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)).

Please include the affected version or commit, a description of the impact, and steps to reproduce (in mock
mode, without real patient data). We aim to acknowledge reports within a week. This is a volunteer project, so
fix timelines depend on severity and availability; we will keep you informed and credit you in the advisory
unless you prefer otherwise.

## Supported versions

Only the latest commit on the default branch receives security fixes.

## Scope

In scope: this repository's code — the API server, web app, Docker/Caddy configuration and documentation.

Out of scope: vulnerabilities in LibreLinkUp / LibreView or other Abbott services (report those to Abbott),
issues in third-party dependencies that are already publicly known (please still tell us if we need to upgrade),
and problems caused by an insecure deployment (e.g. running without HTTPS or exposing the database).

## Hardening already in place

Argon2id password hashing; server-side sessions in httpOnly SameSite cookies; session-bound double-submit CSRF
tokens; strict Content-Security-Policy; login rate limiting; per-request patient authorisation checks (with
tests); AES-256-GCM encryption of stored LibreLinkUp credentials and tokens; log redaction; allow-listed Web Push
endpoints (SSRF protection); audit log. See [docs/privacy.md](docs/privacy.md) for operator guidance.
