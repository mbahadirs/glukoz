import type { PrismaClient } from '@prisma/client';
import type { Env } from './config/env.js';
import type { Cipher } from './crypto/aes.js';
import type { AlertEngine } from './alerts/engine.js';
import type { PushService } from './alerts/push.js';
import type { Collector } from './collector/collector.js';
import type { RealtimeBus } from './lib/realtime.js';
import type { RuntimeSettings } from './lib/settings.js';
import type { LluClientFactory } from './llu/index.js';
import type { ReportService } from './services/reports.js';

export interface AppContext {
  env: Env;
  cipher: Cipher;
  bus: RealtimeBus;
  push: PushService;
  alerts: AlertEngine;
  collector: Collector;
  settings: RuntimeSettings;
  reports: ReportService;
  clientFactory: LluClientFactory;
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    ctx: AppContext;
  }
}
