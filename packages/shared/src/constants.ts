/** Uluslararası CGM konsensüs aralıkları (mg/dL). Rapor her zaman bunlarla hesaplanır. */
export const GLUCOSE_THRESHOLDS = {
  VERY_LOW: 54,
  LOW: 70,
  HIGH: 180,
  VERY_HIGH: 250,
  TIGHT_HIGH: 140,
} as const;

export const MGDL_PER_MMOL = 18.0182;

/**
 * Consensus goals (Battelino et al., Diabetes Care 2019) for the standard 70–180 mg/dL bands — percent.
 * Pregnancy is intentionally not listed: its consensus uses a different band (63–140 mg/dL), which these
 * fixed 70–180 bands cannot express. The patient's personal target band is configured separately.
 */
export const TIR_GOALS = {
  general: { veryLowMax: 1, lowTotalMax: 4, inRangeMin: 70, highTotalMax: 25, veryHighMax: 5 },
  olderHighRisk: {
    veryLowMax: 1,
    lowTotalMax: 1,
    inRangeMin: 50,
    highTotalMax: 50,
    veryHighMax: 10,
  },
} as const;
export type TirGoalProfile = keyof typeof TIR_GOALS;

export const DATA_SUFFICIENCY_MIN_PERCENT = 70;
export const DEFAULT_SENSOR_LIFE_DAYS = 15;
export const SLOT_MINUTES = 5;
export const SLOT_MS = SLOT_MINUTES * 60_000;

export const TREND_CODES = {
  0: 'NOT_COMPUTABLE',
  1: 'SINGLE_DOWN',
  2: 'FORTY_FIVE_DOWN',
  3: 'FLAT',
  4: 'FORTY_FIVE_UP',
  5: 'SINGLE_UP',
} as const;
export type TrendArrow = keyof typeof TREND_CODES;
export type TrendCode = (typeof TREND_CODES)[TrendArrow];

export const TREND_SYMBOLS: Record<number, string> = {
  0: '–',
  1: '↓',
  2: '↘',
  3: '→',
  4: '↗',
  5: '↑',
};

export const NOTE_TYPES = [
  'meal',
  'insulin_rapid',
  'insulin_basal',
  'exercise',
  'medication',
  'illness',
  'sleep',
  'water',
  'other',
] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const ALERT_KINDS = [
  'urgent_low',
  'low',
  'high',
  'rapid_fall',
  'rapid_rise',
  'stale',
  'sensor_ending',
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export const ROLES = ['ADMIN', 'CAREGIVER', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export type GlucoseUnit = 'mgdl' | 'mmol';

export const CONSENT_VERSION = '2026-01';

export const MEDICAL_DISCLAIMER_KEY = 'disclaimer.medical';
