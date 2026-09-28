import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { PrismaClient } from '@prisma/client';
import './app-context.js';
import type { Env } from './config/env.js';
import { Cipher } from './crypto/aes.js';
import { AlertEngine } from './alerts/engine.js';
import { PushService } from './alerts/push.js';
import { authPlugin } from './auth/plugin.js';
import { Collector } from './collector/collector.js';
import { AppError } from './lib/errors.js';
import { loggerOptions } from './lib/logger.js';
import { RealtimeBus } from './lib/realtime.js';
import { RuntimeSettings } from './lib/settings.js';
import { createLluClientFactory, type LluClientFactory } from './llu/index.js';
import { ReportService } from './services/reports.js';
import { registerRoutes } from './routes/index.js';

export interface BuildOptions {
  env: Env;
  prisma: PrismaClient;
  clientFactory?: LluClientFactory;
  logger?: boolean;
}

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function buildApp(opts: BuildOptions): Promise<FastifyInstance> {
  const { env, prisma } = opts;
  const app = Fastify({
    logger: opts.logger === false ? false : loggerOptions(env),
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const bus = new RealtimeBus();
  const settings = new RuntimeSettings(prisma, env);
  const push = new PushService(env, prisma, app.log);
  const alerts = new AlertEngine({ prisma, bus, push, env, log: app.log });
  const cipher = new Cipher(env.ENCRYPTION_KEY);
  const clientFactory = opts.clientFactory ?? createLluClientFactory(env);
  const collector = new Collector({
    prisma,
    env,
    log: app.log,
    cipher,
    bus,
    alerts,
    push,
    settings,
    clientFactory,
  });
  app.decorate('prisma', prisma);
  app.decorate('ctx', {
    env,
    cipher,
    bus,
    push,
    alerts,
    collector,
    settings,
    reports: new ReportService(prisma),
    clientFactory,
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // ECharts satır içi stil kullanır
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
    // Üretimde TLS sonlandıran vekil (Caddy/Traefik) arkasında; alt alan adlarını kapsamaz.
    hsts: env.NODE_ENV === 'production' ? { maxAge: 31_536_000, includeSubDomains: false } : false,
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  await app.register(authPlugin, { secret: env.SESSION_SECRET });

  app.setErrorHandler((err: FastifyError & { validation?: unknown }, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
    }
    if (err.validation) {
      return reply
        .status(400)
        .send({ error: { code: 'VALIDATION', message: `Geçersiz istek: ${err.message}` } });
    }
    if (err.statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Çok fazla deneme. Bir dakika sonra tekrar deneyin.',
        },
      });
    }
    if (err.statusCode === 413 || err.code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply
        .status(413)
        .send({ error: { code: 'TOO_LARGE', message: 'Dosya çok büyük (en fazla 20 MB).' } });
    }
    if (err.statusCode && err.statusCode < 500) {
      return reply
        .status(err.statusCode)
        .send({ error: { code: 'BAD_REQUEST', message: err.message } });
    }
    req.log.error({ err }, 'beklenmeyen hata');
    return reply
      .status(500)
      .send({ error: { code: 'INTERNAL', message: 'Beklenmeyen bir hata oluştu.' } });
  });

  await app.register(registerRoutes, { prefix: '/api' });
  await registerWeb(app, env);
  return app;
}

/** Üretimde derlenmiş PWA'yı sunar; SPA yönlendirmesi için bilinmeyen yollar index.html'e düşer. */
async function registerWeb(app: FastifyInstance, env: Env): Promise<void> {
  const dist = resolve(env.WEB_DIST ?? resolve(process.cwd(), '../web/dist'));
  const hasDist = existsSync(resolve(dist, 'index.html'));
  if (hasDist) {
    await app.register(fastifyStatic, {
      root: dist,
      wildcard: false,
      cacheControl: false, // başlık dosya türüne göre aşağıda belirlenir
      setHeaders(res, path) {
        if (
          path.endsWith('sw.js') ||
          path.endsWith('.webmanifest') ||
          path.endsWith('index.html')
        ) {
          res.setHeader('cache-control', 'no-cache');
        } else if (path.includes('/assets/')) {
          res.setHeader('cache-control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('cache-control', 'public, max-age=3600');
        }
      },
    });
  }
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/') || !hasDist || req.method !== 'GET') {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Bulunamadı.' } });
    }
    return reply.header('cache-control', 'no-cache').sendFile('index.html');
  });
}
