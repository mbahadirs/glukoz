import { minuteOfDay } from '@glukoz/metrics';
import type { AlertKind } from '@glukoz/shared';
import type { AlertRuleConfig } from './defaults.js';

/** Saf kural değerlendirmesi — I/O yok, birim testli. */

export interface EvalReading {
  ts: number;
  mgdl: number;
  trend: number | null;
}

export interface EvalContext {
  now: number;
  /** artan sıralı, son birkaç saat */
  readings: readonly EvalReading[];
  sensorEnd: number | null;
}

export interface EvalResult {
  active: boolean;
  mgdl: number | null;
  message: string;
}

/** Değer tabanlı kurallarda bu yaştan eski veriyle uyarı üretilmez. */
const FRESH_MS = 20 * 60_000;

const inactive: EvalResult = { active: false, mgdl: null, message: '' };

/** Son okumadan geriye koşulun kesintisiz sürdüğü süre (ms). */
function sustainedMs(readings: readonly EvalReading[], cond: (r: EvalReading) => boolean): number {
  const last = readings[readings.length - 1];
  if (!last || !cond(last)) return -1;
  let start = last.ts;
  for (let i = readings.length - 2; i >= 0; i--) {
    const r = readings[i] as EvalReading;
    if (!cond(r)) break;
    start = r.ts;
  }
  return last.ts - start;
}

function valueRule(
  rule: AlertRuleConfig,
  ctx: EvalContext,
  cond: (r: EvalReading) => boolean,
  message: (mgdl: number) => string,
): EvalResult {
  const last = ctx.readings[ctx.readings.length - 1];
  if (!last || ctx.now - last.ts > FRESH_MS) return inactive;
  const held = sustainedMs(ctx.readings, cond);
  if (held < 0 || held < rule.sustainMin * 60_000) return inactive;
  return { active: true, mgdl: last.mgdl, message: message(last.mgdl) };
}

const DEFAULT_THRESHOLDS: Partial<Record<AlertKind, number>> = {
  urgent_low: 54,
  low: 70,
  high: 250,
  rapid_fall: 120,
};

export function evaluateRule(rule: AlertRuleConfig, ctx: EvalContext): EvalResult {
  if (!rule.enabled) return inactive;
  const th = rule.thresholdMgdl ?? DEFAULT_THRESHOLDS[rule.kind] ?? 0;
  switch (rule.kind) {
    case 'urgent_low':
      return valueRule(
        rule,
        ctx,
        (r) => r.mgdl < th,
        (v) => `Çok düşük glukoz: ${v} mg/dL`,
      );
    case 'low':
      return valueRule(
        rule,
        ctx,
        (r) => r.mgdl < th,
        (v) => `Düşük glukoz: ${v} mg/dL (${rule.sustainMin} dk+)`,
      );
    case 'high':
      return valueRule(
        rule,
        ctx,
        (r) => r.mgdl > th,
        (v) => `Yüksek glukoz: ${v} mg/dL (${rule.sustainMin} dk+)`,
      );
    case 'rapid_fall':
      return valueRule(
        { ...rule, sustainMin: 0 },
        ctx,
        (r) => r.trend === 1 && r.mgdl < th,
        (v) => `Hızlı düşüş: ${v} mg/dL ↓`,
      );
    case 'rapid_rise':
      return valueRule(
        { ...rule, sustainMin: 0 },
        ctx,
        (r) => r.trend === 5,
        (v) => `Hızlı yükseliş: ${v} mg/dL ↑`,
      );
    case 'stale': {
      const last = ctx.readings[ctx.readings.length - 1];
      if (!last) return inactive;
      const ageMin = Math.floor((ctx.now - last.ts) / 60_000);
      return ageMin > rule.sustainMin
        ? {
            active: true,
            mgdl: null,
            message: `Veri kesintisi: ${ageMin} dakikadır yeni değer yok`,
          }
        : inactive;
    }
    case 'sensor_ending': {
      if (ctx.sensorEnd === null) return inactive;
      const leftMin = (ctx.sensorEnd - ctx.now) / 60_000;
      if (leftMin <= 0 || leftMin > rule.sustainMin) return inactive;
      const h = Math.max(1, Math.round(leftMin / 60));
      return { active: true, mgdl: null, message: `Sensör yaklaşık ${h} saat içinde bitecek` };
    }
    default:
      return inactive;
  }
}

function hhmmToMin(v: string): number {
  const [h, m] = v.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Sessiz saatler (hasta saat dilimine göre). `urgent_low` asla sessize alınmaz. */
export function isQuietTime(rule: AlertRuleConfig, now: number, timezone: string): boolean {
  if (rule.kind === 'urgent_low' || !rule.quietStart || !rule.quietEnd) return false;
  const m = minuteOfDay(now, timezone);
  const s = hhmmToMin(rule.quietStart);
  const e = hhmmToMin(rule.quietEnd);
  if (s === e) return false;
  return s < e ? m >= s && m < e : m >= s || m < e;
}

export function inCooldown(
  lastFiredAt: number | null,
  rule: AlertRuleConfig,
  now: number,
): boolean {
  return lastFiredAt !== null && now - lastFiredAt < rule.cooldownMin * 60_000;
}

/** "Düzeldi" bildirimi gönderilecek türler. */
export const RESOLVABLE_KINDS: ReadonlySet<AlertKind> = new Set(['urgent_low', 'low', 'high']);
