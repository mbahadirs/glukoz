import { MGDL_PER_MMOL, type GlucoseUnit } from './constants.js';

export function mgdlToMmol(mgdl: number): number {
  return Math.round((mgdl / MGDL_PER_MMOL) * 10) / 10;
}

export function mmolToMgdl(mmol: number): number {
  return Math.round(mmol * MGDL_PER_MMOL);
}

/** Gösterim için dönüşüm; hesaplamalar daima mg/dL. */
export function convertGlucose(mgdl: number, unit: GlucoseUnit): number {
  return unit === 'mmol' ? mgdlToMmol(mgdl) : Math.round(mgdl);
}

export function formatGlucose(mgdl: number, unit: GlucoseUnit, locale = 'tr-TR'): string {
  const value = convertGlucose(mgdl, unit);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: unit === 'mmol' ? 1 : 0,
    maximumFractionDigits: unit === 'mmol' ? 1 : 0,
  }).format(value);
}

export function unitLabel(unit: GlucoseUnit): string {
  return unit === 'mmol' ? 'mmol/L' : 'mg/dL';
}
