import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { CONSENT_VERSION } from '@glukoz/shared';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createPrisma, type PrismaClient } from '../src/lib/prisma.js';
import { hashPassword } from '../src/auth/password.js';
import type { LluClientFactory } from '../src/llu/index.js';
import { MockLluClient } from '../src/llu/mock.js';

export const TABLES = [
  'audit_logs',
  'collector_runs',
  'push_subscriptions',
  'alert_events',
  'alert_rules',
  'notes',
  'sensors',
  'logbook_entries',
  'readings',
  'patient_access',
  'patients',
  'llu_accounts',
  'consents',
  'sessions',
  'users',
  'settings',
];

let prismaSingleton: PrismaClient | null = null;
export function testPrisma(): PrismaClient {
  prismaSingleton ??= createPrisma();
  return prismaSingleton;
}

export async function resetDb(prisma = testPrisma()): Promise<void> {
  if (!/_test(\?|$)/.test(new URL(process.env.DATABASE_URL ?? '').pathname))
    throw new Error('resetDb yalnızca test veritabanında çalışır');
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

export async function makeApp(clientFactory?: LluClientFactory): Promise<FastifyInstance> {
  const env = loadEnv();
  const app = await buildApp({
    env,
    prisma: testPrisma(),
    logger: false,
    clientFactory: clientFactory ?? (() => new MockLluClient('none')),
  });
  await app.ready();
  return app;
}

export interface Agent {
  cookies: string;
  csrf: string;
  userId: string;
}

function cookieHeader(res: LightMyRequestResponse): string {
  return res.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

export async function createUser(
  role: 'ADMIN' | 'CAREGIVER' | 'VIEWER',
  email: string,
  password = 'correct-horse-battery',
  consent = true,
): Promise<string> {
  const prisma = testPrisma();
  const user = await prisma.user.create({
    data: { email, role, displayName: email, passwordHash: await hashPassword(password) },
  });
  if (consent) await prisma.consent.create({ data: { userId: user.id, version: CONSENT_VERSION } });
  return user.id;
}

let ipCounter = 0;

export async function login(
  app: FastifyInstance,
  email: string,
  password = 'correct-horse-battery',
): Promise<Agent> {
  // Her giriş farklı bir IP'den: IP başına 5/dk giriş sınırı testleri etkilemesin.
  ipCounter += 1;
  const remoteAddress = `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
    remoteAddress,
  });
  if (res.statusCode !== 200) throw new Error(`login failed ${res.statusCode} ${res.body}`);
  const body = res.json();
  return { cookies: cookieHeader(res), csrf: body.csrfToken, userId: body.user.id };
}

export function authed(agent: Agent, extra: Record<string, string> = {}): Record<string, string> {
  return { cookie: agent.cookies, 'x-csrf-token': agent.csrf, ...extra };
}

export async function createPatientFixture(prisma = testPrisma()) {
  const account = await prisma.lluAccount.create({
    data: { label: 'Test', emailEnc: 'x', passwordEnc: 'x', status: 'paused' },
  });
  const mk = (id: string, first: string) =>
    prisma.patient.create({
      data: { accountId: account.id, lluPatientId: id, firstName: first, lastName: 'Hasta' },
    });
  return { account, p1: await mk('ext-1', 'Bir'), p2: await mk('ext-2', 'İki') };
}
