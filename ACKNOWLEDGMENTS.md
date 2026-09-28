# Acknowledgments

Glukoz Panel stands on the shoulders of people who shared their work openly. Thank you.

## LibreLinkUp community research

LibreLinkUp has no public API documentation. What is publicly known about its endpoints, headers, region
redirects, error codes and timestamp formats comes from the diabetes open-source community, including the
projects below. This repository does **not** contain code copied from them; they are credited as the sources of
community knowledge this client relies on. Their licenses apply to their own code.

| Project                                                                                    | Author / maintainers                                                | License  | Relevant topics                                                           |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| [LibreLinkUp HTTP dump](https://gist.github.com/khskekec/6c13ba01b10d3018d816706a32ae8ab2) | [@khskekec](https://github.com/khskekec)                            | —        | Request/response shapes of the LibreLinkUp API                            |
| [nightscout-librelink-up](https://github.com/timoschlueter/nightscout-librelink-up)        | [@timoschlueter](https://github.com/timoschlueter) and contributors | MIT      | Polling approach, region handling, keeping up with header/version changes |
| [libre-link-up-api-client](https://github.com/DiaKEM/libre-link-up-api-client)             | [DiaKEM](https://github.com/DiaKEM)                                 | MIT      | Client structure, trend arrow mapping                                     |
| [pylibrelinkup](https://github.com/robberwick/pylibrelinkup)                               | [@robberwick](https://github.com/robberwick) and contributors       | MIT      | Endpoint coverage, error handling, `Account-Id` header                    |
| [nightscout-connect](https://github.com/nightscout/nightscout-connect)                     | [Nightscout](https://github.com/nightscout) contributors            | AGPL-3.0 | Bridging cloud CGM sources, operational lessons                           |
| [Nightscout (cgm-remote-monitor)](https://github.com/nightscout/cgm-remote-monitor)        | [Nightscout](https://github.com/nightscout) contributors            | AGPL-3.0 | Pioneering open-source remote CGM monitoring (#WeAreNotWaiting)           |

If you maintain one of these projects and think the attribution should be worded differently, please open an
issue — we will gladly fix it.

## Clinical definitions

The report metrics follow published consensus statements and papers. We implemented them from the
publications; any errors are ours. Details and formulas: [docs/metrics.md](docs/metrics.md).

- Battelino T, Danne T, Bergenstal RM, et al. _Clinical Targets for Continuous Glucose Monitoring Data
  Interpretation: Recommendations From the International Consensus on Time in Range._ Diabetes Care.
  2019;42(8):1593–1603. — time-in-range bands and targets.
- Battelino T, Alexander CM, Amiel SA, et al. _Continuous glucose monitoring and metrics for clinical trials: an
  international consensus statement._ Lancet Diabetes Endocrinol. 2023;11(1):42–57. — hypo-/hyperglycaemic
  event definitions (≥ 15 minutes).
- Danne T, Nimri R, Battelino T, et al. _International Consensus on Use of Continuous Glucose Monitoring._
  Diabetes Care. 2017;40(12):1631–1640. — coefficient of variation (CV) threshold of 36 %.
- Bergenstal RM, Beck RW, Close KL, et al. _Glucose Management Indicator (GMI): A New Term for Estimating A1C
  From Continuous Glucose Monitoring._ Diabetes Care. 2018;41(11):2275–2280.
- Klonoff DC, Wang J, Rodbard D, et al. _A Glycemia Risk Index (GRI) of Hypoglycemia and Hyperglycemia for
  Continuous Glucose Monitoring Validated by Clinician Ratings._ J Diabetes Sci Technol. 2023;17(5):1226–1242.
- Kovatchev BP, Cox DJ, Gonder-Frederick LA, Clarke W. _Symmetrization of the blood glucose measurement scale and
  its applications._ Diabetes Care. 1997;20(11):1655–1658. — LBGI / HBGI risk functions.
- The **Ambulatory Glucose Profile (AGP)** report format was developed by the International Diabetes Center
  (Minneapolis). Our chart is an independent implementation inspired by it and is not an official AGP report.

## Open-source software

The application is built with Fastify, Prisma, PostgreSQL, React, Vite, TanStack Router and Query, Tailwind CSS,
Apache ECharts, Zod, Day.js, i18next, Workbox, web-push, Vitest, Playwright, MSW and many more. The Inter
typeface by Rasmus Andersson and the Inter Project Authors is used under the SIL Open Font License.
See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the full list and license notices.

## Documents and templates

- [Contributor Covenant](https://www.contributor-covenant.org), version 2.1 — our [Code of Conduct](CODE_OF_CONDUCT.md).
- [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html) — our [LICENSE](LICENSE).

## How this project was made

The specification, product decisions and testing with real devices were done by
[@mbahadirs](https://github.com/mbahadirs). Much of the implementation was written with the help of an AI coding
assistant (Claude Code by Anthropic) under the author's direction and review, together with an automated test
suite. We mention this for transparency; please review and test changes as you would any other code.
