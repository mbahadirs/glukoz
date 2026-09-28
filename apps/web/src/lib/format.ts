import { convertGlucose, formatGlucose, unitLabel, type GlucoseUnit } from '@glukoz/shared';

export { formatGlucose, unitLabel };

export function localeTag(lang: string): string {
  return lang.startsWith('en') ? 'en-GB' : 'tr-TR';
}

export function fmtGlucose(
  mgdl: number | null | undefined,
  unit: GlucoseUnit,
  lang = 'tr',
): string {
  if (mgdl === null || mgdl === undefined || !Number.isFinite(mgdl)) return '–';
  return formatGlucose(mgdl, unit, localeTag(lang));
}

/** Delta: işaretli, birim dönüşümlü. */
export function fmtDelta(delta: number | null, unit: GlucoseUnit, lang = 'tr'): string {
  if (delta === null) return '–';
  const v = unit === 'mmol' ? Math.round((delta / 18.0182) * 10) / 10 : Math.round(delta);
  const s = new Intl.NumberFormat(localeTag(lang), {
    minimumFractionDigits: unit === 'mmol' ? 1 : 0,
    maximumFractionDigits: unit === 'mmol' ? 1 : 0,
    signDisplay: 'exceptZero',
  }).format(v);
  return s;
}

export function fmtNumber(v: number | null | undefined, digits = 1, lang = 'tr'): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '–';
  return new Intl.NumberFormat(localeTag(lang), {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(v);
}

export function fmtPercent(v: number | null | undefined, lang = 'tr'): string {
  if (v === null || v === undefined) return '–';
  return new Intl.NumberFormat(localeTag(lang), {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(v / 100);
}

/** Dakikayı "1 sa 25 dk" biçimine çevirir. */
export function fmtMinutes(
  min: number | null | undefined,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  if (min === null || min === undefined) return '–';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return t('units.minutes', { count: m });
  if (m === 0) return t('units.hours', { count: h });
  return t('units.hoursMinutes', { h, m });
}

/** Grafik ekseni için birim dönüşümü (mmol bir ondalık). */
export function chartValue(mgdl: number | null, unit: GlucoseUnit): number | null {
  if (mgdl === null) return null;
  return unit === 'mmol' ? Math.round((mgdl / 18.0182) * 10) / 10 : Math.round(mgdl);
}

export { convertGlucose };

/** Değişim hızı (mg/dL/dk veya mmol/L/dk), işaretli. */
export function fmtRate(ratePerMin: number, unit: GlucoseUnit, lang = 'tr'): string {
  const v = unit === 'mmol' ? ratePerMin / 18.0182 : ratePerMin;
  const digits = unit === 'mmol' ? 2 : 1;
  return new Intl.NumberFormat(localeTag(lang), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: 'exceptZero',
  }).format(v);
}
