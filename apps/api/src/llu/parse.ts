import { TREND_CODES, type TrendCode } from '@glukoz/shared';
import type { LluMeasurement } from './types.js';

/** `M/D/YYYY h:mm:ss AM|PM` — tek/çift haneli alanlar, İngilizce AM/PM. */
const FACTORY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) ?(AM|PM)$/i;

/**
 * `FactoryTimestamp` (ABD biçimi, UTC) → ms UTC, saniyeye yuvarlanmış. Geçersizse null.
 */
export function parseFactoryTimestamp(value: string): number | null {
  const m = FACTORY_RE.exec(value.trim());
  if (!m) return null;
  const [, mo, d, y, h, mi, s, ap] = m as unknown as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const month = Number(mo);
  const day = Number(d);
  const hour12 = Number(h);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour12 < 1 || hour12 > 12) return null;
  if (Number(mi) > 59 || Number(s) > 59) return null;
  const hour = (hour12 % 12) + (ap.toUpperCase() === 'PM' ? 12 : 0);
  const ts = Date.UTC(Number(y), month - 1, day, hour, Number(mi), Number(s));
  // 31 Şubat gibi taşan tarihleri reddet
  if (new Date(ts).getUTCDate() !== day) return null;
  return ts;
}

export function trendCode(arrow: number | null | undefined): TrendCode {
  if (arrow === null || arrow === undefined) return 'NOT_COMPUTABLE';
  return (TREND_CODES as Record<number, TrendCode>)[arrow] ?? 'NOT_COMPUTABLE';
}

/** 1–5 dışındaki değerler (0 / yok) null olarak saklanır. */
export function normalizeTrend(arrow: number | null | undefined): number | null {
  return arrow !== null && arrow !== undefined && arrow >= 1 && arrow <= 5 ? arrow : null;
}

export interface ParsedReading {
  ts: Date;
  mgdl: number;
  trend: number | null;
  deviceLocalTs: string | null;
}

/** Ölçümü okumaya çevirir. `ValueInMgPerDl` kullanılır; `Value`, renk ve isHigh/isLow yok sayılır. */
export function parseMeasurement(m: LluMeasurement): ParsedReading | null {
  const ts = parseFactoryTimestamp(m.FactoryTimestamp);
  const mgdl = Math.round(m.ValueInMgPerDl);
  if (ts === null || !Number.isFinite(mgdl) || mgdl <= 0 || mgdl > 1000) return null;
  return {
    ts: new Date(ts),
    mgdl,
    trend: normalizeTrend(m.TrendArrow),
    deviceLocalTs: m.Timestamp ?? null,
  };
}

/** Sensör bitişi: aktivasyon (unix sn) + ömür (gün). */
export function sensorExpectedEnd(activationUnixSec: number, lifeDays: number): Date {
  return new Date(activationUnixSec * 1000 + lifeDays * 86_400_000);
}
