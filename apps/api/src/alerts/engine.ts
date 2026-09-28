import type { FastifyBaseLogger } from 'fastify';
import type { AlertEvent, AlertRule, PrismaClient } from '@prisma/client';
import { ALERT_KINDS, TREND_SYMBOLS, type AlertEventDto, type AlertKind } from '@glukoz/shared';
import type { Env } from '../config/env.js';
import type { RealtimeBus } from '../lib/realtime.js';
import { DEFAULT_ALERT_RULES, type AlertRuleConfig } from './defaults.js';
import {
  evaluateRule,
  inCooldown,
  isQuietTime,
  RESOLVABLE_KINDS,
  type EvalReading,
} from './evaluate.js';
import type { PushService } from './push.js';

const LOOKBACK_MS = 4 * 3600_000;

export function toAlertEventDto(e: AlertEvent, kind: string | null): AlertEventDto {
  return {
    id: e.id,
    ruleId: e.ruleId,
    kind: (ALERT_KINDS as readonly string[]).includes(kind ?? '') ? (kind as AlertKind) : null,
    patientId: e.patientId,
    firedAt: e.firedAt.toISOString(),
    mgdl: e.mgdl,
    message: e.message,
    ackBy: e.ackBy,
    ackAt: e.ackAt?.toISOString() ?? null,
  };
}

function toConfig(r: AlertRule): AlertRuleConfig {
  return {
    kind: r.kind as AlertKind,
    enabled: r.enabled,
    thresholdMgdl: r.thresholdMgdl,
    sustainMin: r.sustainMin,
    cooldownMin: r.cooldownMin,
    quietStart: r.quietStart,
    quietEnd: r.quietEnd,
  };
}

export async function ensureDefaultRules(prisma: PrismaClient, patientId: string): Promise<void> {
  await prisma.alertRule.createMany({
    data: DEFAULT_ALERT_RULES.map((r) => ({ ...r, patientId })),
    skipDuplicates: true,
  });
}

/** Her yeni okuma sonrası ve periyodik olarak (veri kesintisi, sensör bitişi) çalışır. */
export class AlertEngine {
  private readonly activeState = new Map<string, boolean>();

  constructor(
    private readonly deps: {
      prisma: PrismaClient;
      bus: RealtimeBus;
      push: PushService;
      env: Env;
      log: FastifyBaseLogger;
    },
  ) {}

  async evaluatePatient(patientId: string, now = Date.now()): Promise<AlertEventDto[]> {
    const { prisma } = this.deps;
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        alertRules: true,
        sensors: { where: { endedAt: null }, orderBy: { activatedAt: 'desc' }, take: 1 },
      },
    });
    if (!patient) return [];
    const rows = await prisma.reading.findMany({
      where: { patientId, ts: { gte: new Date(now - LOOKBACK_MS) } },
      orderBy: { ts: 'asc' },
      select: { ts: true, mgdl: true, trend: true },
    });
    const readings: EvalReading[] = rows.map((r) => ({
      ts: r.ts.getTime(),
      mgdl: r.mgdl,
      trend: r.trend,
    }));
    // Lookback içinde hiç okuma yoksa veri kesintisi için en son okumayı ekle.
    if (readings.length === 0) {
      const last = await prisma.reading.findFirst({
        where: { patientId },
        orderBy: { ts: 'desc' },
      });
      if (last) readings.push({ ts: last.ts.getTime(), mgdl: last.mgdl, trend: last.trend });
    }
    const sensorEnd = patient.sensors[0]?.expectedEnd.getTime() ?? null;
    const name = patient.displayName ?? `${patient.firstName} ${patient.lastName}`.trim();
    const fired: AlertEventDto[] = [];

    for (const rule of patient.alertRules) {
      const cfg = toConfig(rule);
      const result = evaluateRule(cfg, { now, readings, sensorEnd });
      const wasActive = this.activeState.get(rule.id) ?? false;
      this.activeState.set(rule.id, result.active);
      if (!result.active) {
        if (wasActive && RESOLVABLE_KINDS.has(cfg.kind) && this.deps.env.ALERT_NOTIFY_RESOLVED) {
          await this.notify(
            patientId,
            `${name}: düzeldi`,
            'Değer normale döndü.',
            `resolved-${cfg.kind}`,
            false,
            now,
            cfg,
            patient.timezone,
          );
        }
        continue;
      }
      const last = await prisma.alertEvent.findFirst({
        where: { ruleId: rule.id },
        orderBy: { firedAt: 'desc' },
      });
      if (inCooldown(last?.firedAt.getTime() ?? null, cfg, now)) continue;
      const event = await prisma.alertEvent.create({
        data: {
          ruleId: rule.id,
          patientId,
          mgdl: result.mgdl,
          message: result.message,
          firedAt: new Date(now),
        },
      });
      const dto = toAlertEventDto(event, cfg.kind);
      fired.push(dto);
      this.deps.bus.publish({ type: 'alert', patientId, alert: dto });
      const lastReading = readings[readings.length - 1];
      const arrow = lastReading?.trend ? ` ${TREND_SYMBOLS[lastReading.trend] ?? ''}` : '';
      const title = result.mgdl !== null ? `${name}: ${result.mgdl} mg/dL${arrow}` : name;
      await this.notify(
        patientId,
        title,
        result.message,
        cfg.kind,
        cfg.kind === 'urgent_low',
        now,
        cfg,
        patient.timezone,
      );
    }
    return fired;
  }

  private async notify(
    patientId: string,
    title: string,
    body: string,
    tag: string,
    renotify: boolean,
    now: number,
    cfg: AlertRuleConfig,
    timezone: string,
  ): Promise<void> {
    if (isQuietTime(cfg, now, timezone)) return;
    const users = await this.deps.push.usersForPatient(patientId);
    await this.deps.push.sendToUsers(users, {
      title,
      body,
      tag: `${patientId}:${tag}`,
      renotify,
      data: { url: `/?patient=${patientId}` },
    });
  }

  /** Zaman tabanlı kurallar için (stale, sensor_ending) tüm hastaları değerlendirir. */
  async evaluateAll(now = Date.now()): Promise<void> {
    const patients = await this.deps.prisma.patient.findMany({
      where: { account: { status: 'active' } },
      select: { id: true },
    });
    for (const p of patients) {
      try {
        await this.evaluatePatient(p.id, now);
      } catch (err) {
        this.deps.log.error({ err, patientId: p.id }, 'uyarı değerlendirme hatası');
      }
    }
  }
}
