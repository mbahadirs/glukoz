# syntax=docker/dockerfile:1.7
# Çok aşamalı derleme: web (statik PWA) + api (esbuild paketi) → root olmayan çalışma imajı.

FROM node:22-alpine AS base
# corepack yerine npm: ağ kesintilerine karşı yeniden denemeli kurulum
RUN apk add --no-cache openssl \
 && npm config set fetch-retries 5 \
 && npm install -g pnpm@9.4.0
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/metrics/package.json packages/metrics/
COPY apps/api/prisma apps/api/prisma
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY . .
# Kaynak kodu bağlantısı (AGPL-3.0 §13) — kendi çatalınız için değiştirin.
ARG VITE_SOURCE_URL=https://github.com/mbahadirs/glukoz
ENV VITE_SOURCE_URL=$VITE_SOURCE_URL
RUN pnpm --filter @glukoz/api exec prisma generate \
 && pnpm --filter @glukoz/web build \
 && pnpm --filter @glukoz/api build \
 && pnpm --filter @glukoz/api deploy --prod /out/api \
 && rm -rf /out/api/dist /out/api/src /out/api/test \
 && cp -r apps/api/dist /out/api/dist \
 && cp -r apps/web/dist /out/web \
 && cd /out/api && npx prisma generate

FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 WEB_DIST=/app/web
WORKDIR /app/api
COPY --from=build --chown=node:node /out/api /app/api
COPY --from=build --chown=node:node /out/web /app/web
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
# Açılışta migration'lar uygulanır, gerekirse veri içe aktarılır, sonra sunucu başlar.
# RESTORE_SNAPSHOT_B64 tanımlıysa ve veritabanı boşsa anlık görüntü içe aktarılır (bkz. src/snapshot.ts).
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/snapshot.js restore && exec node dist/server.js"]
