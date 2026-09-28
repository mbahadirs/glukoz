import { addDays, zonedDayStart } from '@glukoz/metrics';
import type { ReportSearch } from '../router';

export const PERIOD_DAYS = [7, 14, 30, 90] as const;
export const DEFAULT_DAYS = 14;
const QUARTER_HOUR = 15 * 60_000;

export interface Period {
  from: number;
  to: number;
  days: number;
  custom: boolean;
}

const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * URL arama parametrelerinden rapor dönemi: özel aralık (from/to gün, dahil) veya son N gün.
 * Son N gün sorgu anahtarı kararlı kalsın diye 15 dk'ya yuvarlanır.
 */
export function resolvePeriod(search: ReportSearch, tz: string, now = Date.now()): Period {
  if (isDate(search.from) && isDate(search.to) && search.from <= search.to) {
    const from = zonedDayStart(search.from, tz);
    const to = zonedDayStart(addDays(search.to, 1), tz);
    return { from, to, days: Math.round((to - from) / 86_400_000), custom: true };
  }
  const days = (PERIOD_DAYS as readonly number[]).includes(search.days ?? 0)
    ? (search.days as number)
    : DEFAULT_DAYS;
  const to = Math.ceil(now / QUARTER_HOUR) * QUARTER_HOUR;
  return { from: to - days * 86_400_000, to, days, custom: false };
}
