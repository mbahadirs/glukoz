# Third-party notices

Glukoz Panel is built on the work of many open-source projects. We are grateful to their authors and maintainers.
This file lists the **direct** dependencies declared in this repository's `package.json` files, as resolved by
`pnpm-lock.yaml`. Transitive dependencies are not listed individually; their licenses ship with each package in
`node_modules` and in any Docker image you build.

All listed licenses (MIT, Apache-2.0, BSD-3-Clause, MPL-2.0, SIL OFL-1.1) are compatible with distributing this
project under the GNU AGPL-3.0. Each dependency remains under its own license; nothing here changes those terms.

## Runtime dependencies

These are shipped to users: bundled into the web app (browser) or installed in the server image.

| Package                      | Version  | License    | Source                                                 |
| ---------------------------- | -------- | ---------- | ------------------------------------------------------ |
| `@fastify/cookie`            | 11.1.2   | MIT        | https://github.com/fastify/fastify-cookie              |
| `@fastify/helmet`            | 13.1.1   | MIT        | https://github.com/fastify/fastify-helmet              |
| `@fastify/multipart`         | 9.4.0    | MIT        | https://github.com/fastify/fastify-multipart           |
| `@fastify/rate-limit`        | 10.3.0   | MIT        | https://github.com/fastify/fastify-rate-limit          |
| `@fastify/static`            | 8.3.0    | MIT        | https://github.com/fastify/fastify-static              |
| `@fontsource-variable/inter` | 5.3.0    | OFL-1.1    | https://github.com/fontsource/font-files               |
| `@node-rs/argon2`            | 2.2.1    | MIT        | https://github.com/napi-rs/node-rs                     |
| `@prisma/client`             | 6.19.3   | Apache-2.0 | https://github.com/prisma/prisma                       |
| `@tanstack/react-query`      | 5.104.0  | MIT        | https://github.com/TanStack/query                      |
| `@tanstack/react-router`     | 1.170.40 | MIT        | https://github.com/TanStack/router                     |
| `dayjs`                      | 1.11.23  | MIT        | https://github.com/iamkun/dayjs                        |
| `echarts`                    | 5.6.0    | Apache-2.0 | https://github.com/apache/echarts                      |
| `echarts-for-react`          | 3.0.7    | MIT        | https://github.com/hustcc/echarts-for-react            |
| `fastify`                    | 5.12.5   | MIT        | https://github.com/fastify/fastify                     |
| `fastify-plugin`             | 5.1.0    | MIT        | https://github.com/fastify/fastify-plugin              |
| `fastify-type-provider-zod`  | 4.0.2    | MIT        | https://github.com/turkerdev/fastify-type-provider-zod |
| `i18next`                    | 25.10.10 | MIT        | https://github.com/i18next/i18next                     |
| `pino`                       | 9.14.0   | MIT        | https://github.com/pinojs/pino                         |
| `prisma`                     | 6.19.3   | Apache-2.0 | https://github.com/prisma/prisma                       |
| `react`                      | 19.3.0   | MIT        | https://github.com/react/react                         |
| `react-dom`                  | 19.3.0   | MIT        | https://github.com/react/react                         |
| `react-i18next`              | 15.7.4   | MIT        | https://github.com/i18next/react-i18next               |
| `web-push`                   | 3.6.7    | MPL-2.0    | https://github.com/web-push-libs/web-push              |
| `zod`                        | 3.25.76  | MIT        | https://github.com/colinhacks/zod                      |

## Development and build dependencies

These are used for building, testing and linting only; they are not part of the running application.

| Package                     | Version | License    | Source                                                   |
| --------------------------- | ------- | ---------- | -------------------------------------------------------- |
| `@eslint/js`                | 9.39.5  | MIT        | https://github.com/eslint/eslint                         |
| `@playwright/test`          | 1.63.0  | Apache-2.0 | https://github.com/microsoft/playwright                  |
| `@tailwindcss/vite`         | 4.3.3   | MIT        | https://github.com/tailwindlabs/tailwindcss              |
| `@testing-library/jest-dom` | 6.10.0  | MIT        | https://github.com/testing-library/jest-dom              |
| `@testing-library/react`    | 16.3.3  | MIT        | https://github.com/testing-library/react-testing-library |
| `@types/node`               | 22.20.4 | MIT        | https://github.com/DefinitelyTyped/DefinitelyTyped       |
| `@types/react`              | 19.3.0  | MIT        | https://github.com/DefinitelyTyped/DefinitelyTyped       |
| `@types/react-dom`          | 19.3.0  | MIT        | https://github.com/DefinitelyTyped/DefinitelyTyped       |
| `@types/web-push`           | 3.6.4   | MIT        | https://github.com/DefinitelyTyped/DefinitelyTyped       |
| `@vitejs/plugin-react`      | 4.7.0   | MIT        | https://github.com/vitejs/vite-plugin-react              |
| `@vitest/coverage-v8`       | 3.2.7   | MIT        | https://github.com/vitest-dev/vitest                     |
| `dotenv-cli`                | 8.0.0   | MIT        |                                                          |
| `esbuild`                   | 0.25.12 | MIT        | https://github.com/evanw/esbuild                         |
| `eslint`                    | 9.39.5  | MIT        |                                                          |
| `eslint-plugin-react-hooks` | 5.2.0   | MIT        | https://github.com/facebook/react                        |
| `globals`                   | 16.5.0  | MIT        |                                                          |
| `jsdom`                     | 26.1.0  | MIT        | https://github.com/jsdom/jsdom                           |
| `msw`                       | 2.15.0  | MIT        | https://github.com/mswjs/msw                             |
| `pino-pretty`               | 13.1.3  | MIT        |                                                          |
| `prettier`                  | 3.9.9   | MIT        |                                                          |
| `tailwindcss`               | 4.3.3   | MIT        | https://github.com/tailwindlabs/tailwindcss              |
| `tsx`                       | 4.23.15 | MIT        |                                                          |
| `typescript`                | 5.9.3   | Apache-2.0 | https://github.com/microsoft/TypeScript                  |
| `typescript-eslint`         | 8.70.1  | MIT        | https://github.com/typescript-eslint/typescript-eslint   |
| `vite`                      | 6.4.3   | MIT        | https://github.com/vitejs/vite                           |
| `vite-plugin-pwa`           | 1.3.0   | MIT        | https://github.com/vite-pwa/vite-plugin-pwa              |
| `vitest`                    | 3.2.7   | MIT        | https://github.com/vitest-dev/vitest                     |
| `workbox-core`              | 7.4.1   | MIT        | https://github.com/googlechrome/workbox                  |
| `workbox-expiration`        | 7.4.1   | MIT        | https://github.com/googlechrome/workbox                  |
| `workbox-precaching`        | 7.4.1   | MIT        | https://github.com/googlechrome/workbox                  |
| `workbox-routing`           | 7.4.1   | MIT        | https://github.com/googlechrome/workbox                  |
| `workbox-strategies`        | 7.4.1   | MIT        | https://github.com/googlechrome/workbox                  |
| `workbox-window`            | 7.4.1   | MIT        | https://github.com/googlechrome/workbox                  |

## Required notices

### Apache ECharts (Apache-2.0)

```
Apache ECharts
Copyright 2017-2024 The Apache Software Foundation

This product includes software developed at
The Apache Software Foundation (https://www.apache.org/).
```

Apache ECharts includes portions of **d3** (BSD-3-Clause, Copyright Mike Bostock) and depends on **ZRender**
(BSD-3-Clause, Copyright Baidu Inc.). Their license texts ship in the `echarts` and `zrender` packages
(`node_modules/echarts/licenses/LICENSE-d3`, `node_modules/zrender/LICENSE`).

### Prisma (Apache-2.0)

Prisma ORM and Prisma Client are Copyright Prisma Data, Inc. and licensed under the Apache License 2.0.
The Prisma query engine binaries downloaded at install time are covered by the same license.

### Inter typeface (SIL Open Font License 1.1)

The web app self-hosts the Inter variable font via `@fontsource-variable/inter`.
Inter is Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter) and licensed under the
SIL Open Font License, Version 1.1 (https://openfontlicense.org). The font may be bundled and redistributed with
software, but it may not be sold by itself.

### web-push (MPL-2.0)

`web-push` is used unmodified as a library. Its source is available at https://github.com/web-push-libs/web-push.

## Regenerating this list

Versions change over time. To see the licenses of everything actually installed (including transitive packages):

```bash
pnpm licenses list --long
```
