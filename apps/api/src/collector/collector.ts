import type { FastifyBaseLogger } from 'fastify';
import type { LluAccount, PrismaClient } from '@prisma/client';
import type { Env } from '../config/env.js';
import type { Cipher } from '../crypto/aes.js';
import { AlertEngine, ensureDefaultRules } from '../alerts/engine.js';
import type { PushService } from '../alerts/push.js';
import type { RealtimeBus } from '../lib/realtime.js';
import type { RuntimeSettings } from '../lib/settings.js';
import { LluError, sensorExpectedEnd, type LluApi, type LluClientFactory } from '../llu/index.js';
import { LluSource } from '../sources/llu-source.js';
import type { SourcePatient } from '../sources/types.js';
import { latestReadingBefore, upsertLogbook, upsertReadings, type StoredReading } from './store.js';
import { backoffDelayMs, jitterMs } from './backoff.js';
import { withAccountLock } from './lock.js';
import { sanitizeErrorText } from '../lib/sanitize.js';

const GAP_BACKFILL_MS = 15 * 60_000;
const MAX_AUTH_FAILURES = 3;
const AUTH_ERROR_CODES = new Set([
  'LLU_BAD_CREDENTIALS',
  'LLU_ACTION_REQUIRED',
  'LLU_UNAUTHORIZED',
  'LLU_HTTP',
]);

interface AccountState {
  client: LluApi;
  nextGraphAt: Map<string, number>;
  nextLogbookAt: Map<string, number>;
  backoffUntil: number;
  backoffStep: number;
}

export interface CollectorDeps {
  prisma: PrismaClient;
  env: Env;
  log: FastifyBaseLogger;
  cipher: Cipher;
  bus: RealtimeBus;
  alerts: AlertEngine;
  push: PushService;
  settings: RuntimeSettings;
  clientFactory: LluClientFactory;
  now?: () => number;
}

export interface RunResult {
  ok: boolean;
  errorCode: string | null;
  newReadings: number;
  skipped?: 'locked' | 'backoff' | 'busy';
}

/**
 * Periyodik veri toplayıcı. Hesap başına: connections (60 sn), graph (15 dk + boşlukta),
 * logbook (6 saat). Aynı hesap için döngüler üst üste binmez (bellek içi mutex + PG advisory lock).
 */
export class Collector {
  private readonly states = new Map<string, AccountState>();
  private readonly running = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private stopping = false;
  private currentTick: Promise<void> | null = null;
  private readonly now: () => number;

  constructor(private readonly deps: CollectorDeps) {
    this.now = deps.now ?? Date.now;
  }

  start(): void {
    this.stopping = false;
    this.schedule(1_000);
  }

  private schedule(delayMs: number): void {
    if (this.stopping) return;
    this.timer = setTimeout(() => {
      this.currentTick = this.tick()
        .catch((err) => this.deps.log.error({ err }, 'collector döngüsü hata verdi'))
        .finally(() => {
          this.currentTick = null;
          this.schedule(this.deps.env.LLU_POLL_SECONDS * 1000 + jitterMs());
        });
    }, delayMs);
  }

  /** SIGTERM: açık döngünün bitmesini en fazla 10 sn bekler. */
  async stop(timeoutMs = 10_000): Promise<void> {
    this.stopping = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.currentTick) {
      await Promise.race([this.currentTick, new Promise((r) => setTimeout(r, timeoutMs))]);
    }
  }

  async tick(): Promise<void> {
    const accounts = await this.deps.prisma.lluAccount.findMany({ where: { status: 'active' } });
    for (const account of accounts) {
      if (this.stopping) break;
      await this.runAccount(account);
    }
    await this.deps.alerts.evaluateAll(this.now());
  }

  /** Hesap için istemciyi (şifreli oturumla) hazırlar; önbellekte tutar. */
  private async stateFor(account: LluAccount): Promise<AccountState> {
    const existing = this.states.get(account.id);
    if (existing) return existing;
    const { cipher, prisma, settings, log } = this.deps;
    const { product, version } = await settings.lluProductVersion();
    const session =
      account.tokenEnc && account.tokenExpiresAt && account.lluUserId
        ? {
            token: cipher.decrypt(account.tokenEnc),
            expires: Math.floor(account.tokenExpiresAt.getTime() / 1000),
            userId: account.lluUserId,
            region: account.region ?? 'global',
          }
        : null;
    const client = this.deps.clientFactory({
      email: cipher.decrypt(account.emailEnc),
      password: cipher.decrypt(account.passwordEnc),
      region: account.region,
      product,
      version,
      session,
      onSession: async (s) => {
        await prisma.lluAccount.update({
          where: { id: account.id },
          data: {
            tokenEnc: cipher.encrypt(s.token),
            tokenExpiresAt: new Date(s.expires * 1000),
            region: s.region,
            lluUserId: s.userId,
          },
        });
      },
      onVersionUpgrade: async (v, min) => {
        log.warn({ minimumVersion: min }, 'LLU sürümü otomatik yükseltildi');
        await settings.set('llu.version', v);
        await settings.set('llu.minimumVersionSeen', min);
        await this.deps.push.notifyAdmins('LibreLinkUp sürümü yükseltildi', `Yeni sürüm: ${v}`);
      },
    });
    const state: AccountState = {
      client,
      nextGraphAt: new Map(),
      nextLogbookAt: new Map(),
      backoffUntil: 0,
      backoffStep: 0,
    };
    this.states.set(account.id, state);
    return state;
  }

  /** Hesap bilgileri değiştiğinde istemci önbelleğini temizler (`*` = tümü). */
  forget(accountId: string): void {
    if (accountId === '*') this.states.clear();
    else this.states.delete(accountId);
  }

  async runAccount(account: LluAccount): Promise<RunResult> {
    if (this.running.has(account.id))
      return { ok: true, errorCode: null, newReadings: 0, skipped: 'busy' };
    this.running.add(account.id);
    try {
      const state = await this.stateFor(account);
      if (this.now() < state.backoffUntil)
        return { ok: true, errorCode: null, newReadings: 0, skipped: 'backoff' };
      const locked = await withAccountLock(this.deps.prisma, account.id, () =>
        this.collect(account, state),
      );
      return locked ?? { ok: true, errorCode: null, newReadings: 0, skipped: 'locked' };
    } finally {
      this.running.delete(account.id);
    }
  }

  private async collect(account: LluAccount, state: AccountState): Promise<RunResult> {
    const startedAt = new Date(this.now());
    const source = new LluSource(state.client);
    let newReadings = 0;
    try {
      const patients = await source.listPatients();
      for (const p of patients) newReadings += await this.syncPatient(account, state, source, p);
      await this.onSuccess(account, state);
      await this.recordRun(account.id, startedAt, true, null, newReadings);
      return { ok: true, errorCode: null, newReadings };
    } catch (err) {
      const code = await this.onFailure(account, state, err);
      await this.recordRun(account.id, startedAt, false, code, newReadings);
      return { ok: false, errorCode: code, newReadings };
    }
  }

  private async syncPatient(
    account: LluAccount,
    state: AccountState,
    source: LluSource,
    sp: SourcePatient,
  ): Promise<number> {
    const { prisma, log } = this.deps;
    const now = this.now();
    const existing = await prisma.patient.findUnique({
      where: { accountId_lluPatientId: { accountId: account.id, lluPatientId: sp.externalId } },
    });
    const patient = existing
      ? await prisma.patient.update({
          where: { id: existing.id },
          data: {
            firstName: sp.firstName,
            lastName: sp.lastName,
            lluTargetLow: sp.targetLow,
            lluTargetHigh: sp.targetHigh,
          },
        })
      : await prisma.patient.create({
          data: {
            accountId: account.id,
            lluPatientId: sp.externalId,
            firstName: sp.firstName,
            lastName: sp.lastName,
            lluTargetLow: sp.targetLow,
            lluTargetHigh: sp.targetHigh,
            timezone: this.deps.env.DEFAULT_TIMEZONE,
          },
        });
    if (!existing) await ensureDefaultRules(prisma, patient.id);
    if (sp.sensor) await this.syncSensor(patient.id, patient.sensorLifeDays, sp.sensor);

    const inserted: StoredReading[] = [];
    let needsBackfill =
      !state.nextGraphAt.has(patient.id) || now >= (state.nextGraphAt.get(patient.id) ?? 0);
    if (sp.current) {
      const prev = await latestReadingBefore(prisma, patient.id, sp.current.ts);
      const added = await upsertReadings(prisma, patient.id, [sp.current], 'current');
      inserted.push(...added);
      if (added.length && prev && sp.current.ts.getTime() - prev.getTime() > GAP_BACKFILL_MS)
        needsBackfill = true;
    }
    if (needsBackfill) {
      try {
        inserted.push(
          ...(await upsertReadings(
            prisma,
            patient.id,
            await source.history(sp.externalId),
            'graph',
          )),
        );
        state.nextGraphAt.set(
          patient.id,
          now + this.deps.env.LLU_GRAPH_MINUTES * 60_000 + jitterMs(),
        );
      } catch (err) {
        if (err instanceof LluError && err.code === 'LLU_BAD_RESPONSE')
          log.warn({ code: err.code }, 'graph atlandı');
        else throw err;
      }
    }
    if (now >= (state.nextLogbookAt.get(patient.id) ?? 0)) {
      try {
        await upsertLogbook(prisma, patient.id, await source.logbook(sp.externalId));
        state.nextLogbookAt.set(
          patient.id,
          now + this.deps.env.LLU_LOGBOOK_HOURS * 3600_000 + jitterMs(),
        );
      } catch (err) {
        if (err instanceof LluError && err.code === 'LLU_BAD_RESPONSE')
          log.warn({ code: err.code }, 'logbook atlandı');
        else throw err;
      }
    }
    if (inserted.length) {
      const latest = inserted.reduce((a, b) => (a.ts > b.ts ? a : b));
      this.deps.bus.publish({
        type: 'reading',
        patientId: patient.id,
        reading: { ts: latest.ts.toISOString(), mgdl: latest.mgdl, trend: latest.trend },
      });
      await this.deps.alerts.evaluatePatient(patient.id, now);
    }
    return inserted.length;
  }

  private async syncSensor(
    patientId: string,
    lifeDays: number,
    sensor: NonNullable<SourcePatient['sensor']>,
  ): Promise<void> {
    const { prisma } = this.deps;
    const known = await prisma.sensor.findUnique({
      where: { patientId_serial: { patientId, serial: sensor.serial } },
    });
    if (known) return;
    await prisma.$transaction([
      prisma.sensor.updateMany({
        where: { patientId, endedAt: null },
        data: { endedAt: new Date(this.now()) },
      }),
      prisma.sensor.create({
        data: {
          patientId,
          serial: sensor.serial,
          productType: sensor.productType,
          activatedAt: sensor.activatedAt,
          expectedEnd: sensorExpectedEnd(sensor.activatedAt.getTime() / 1000, lifeDays),
        },
      }),
    ]);
  }

  private async onSuccess(account: LluAccount, state: AccountState): Promise<void> {
    state.backoffStep = 0;
    state.backoffUntil = 0;
    if (account.failCount !== 0 || account.lastError !== null) {
      await this.deps.prisma.lluAccount.update({
        where: { id: account.id },
        data: { failCount: 0, lastError: null },
      });
    }
    this.deps.bus.publish({
      type: 'status',
      accountId: account.id,
      ok: true,
      errorCode: null,
      at: new Date(this.now()).toISOString(),
    });
  }

  private async onFailure(account: LluAccount, state: AccountState, err: unknown): Promise<string> {
    const { prisma, log, push } = this.deps;
    const e = err instanceof LluError ? err : null;
    const code = e?.code ?? 'INTERNAL';
    log.warn(
      {
        code,
        accountId: account.id,
        httpStatus: e?.details.httpStatus,
        detail: e ? sanitizeErrorText(e.message, 200) : undefined,
      },
      'LLU toplama başarısız',
    );
    if (!e) log.error({ err }, 'collector beklenmeyen hata');

    const authFailure = e !== null && AUTH_ERROR_CODES.has(code);
    const failCount = authFailure ? account.failCount + 1 : account.failCount;
    const pause = e?.isFatalForAccount === true || failCount >= MAX_AUTH_FAILURES;

    if (code === 'LLU_VERSION_TOO_OLD' && e?.details.minimumVersion) {
      await this.deps.settings.set('llu.minimumVersionSeen', e.details.minimumVersion);
      await push.notifyAdmins(
        'LibreLinkUp sürümü eski',
        `Gereken en düşük sürüm: ${e.details.minimumVersion}`,
      );
    }

    state.backoffStep += 1;
    const minMs =
      code === 'LLU_RATE_LIMITED'
        ? Math.max(5 * 60_000, (e?.details.retryAfterSec ?? 0) * 1000)
        : 0;
    state.backoffUntil = this.now() + Math.max(minMs, backoffDelayMs(state.backoffStep));

    await prisma.lluAccount.update({
      where: { id: account.id },
      data: {
        failCount,
        lastError: sanitizeErrorText(`${code}: ${e?.message ?? 'Beklenmeyen hata'}`),
        ...(pause ? { status: 'paused' as const } : {}),
      },
    });
    if (pause) {
      this.forget(account.id);
      await push.notifyAdmins('LibreLinkUp hesabı duraklatıldı', `${account.label}: ${code}`);
    }
    this.deps.bus.publish({
      type: 'status',
      accountId: account.id,
      ok: false,
      errorCode: code,
      at: new Date(this.now()).toISOString(),
    });
    return code;
  }

  private async recordRun(
    accountId: string,
    startedAt: Date,
    ok: boolean,
    errorCode: string | null,
    newReadings: number,
  ) {
    await this.deps.prisma.collectorRun.create({
      data: {
        accountId,
        startedAt,
        durationMs: this.now() - startedAt.getTime(),
        ok,
        errorCode,
        newReadings,
      },
    });
  }
}
