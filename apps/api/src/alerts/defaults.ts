import type { AlertKind } from '@glukoz/shared';

export interface AlertRuleConfig {
  kind: AlertKind;
  enabled: boolean;
  thresholdMgdl: number | null;
  /** koşulun sürmesi gereken dakika; `stale` için veri yaşı eşiği, `sensor_ending` için bitişe kalan dakika */
  sustainMin: number;
  cooldownMin: number;
  quietStart: string | null;
  quietEnd: string | null;
}

/** Bölüm 10 varsayılanları — hasta eklendiğinde oluşturulur. */
export const DEFAULT_ALERT_RULES: readonly AlertRuleConfig[] = [
  {
    kind: 'urgent_low',
    enabled: true,
    thresholdMgdl: 54,
    sustainMin: 0,
    cooldownMin: 15,
    quietStart: null,
    quietEnd: null,
  },
  {
    kind: 'low',
    enabled: true,
    thresholdMgdl: 70,
    sustainMin: 10,
    cooldownMin: 30,
    quietStart: null,
    quietEnd: null,
  },
  {
    kind: 'high',
    enabled: true,
    thresholdMgdl: 250,
    sustainMin: 30,
    cooldownMin: 60,
    quietStart: null,
    quietEnd: null,
  },
  {
    kind: 'rapid_fall',
    enabled: true,
    thresholdMgdl: 120,
    sustainMin: 0,
    cooldownMin: 30,
    quietStart: null,
    quietEnd: null,
  },
  {
    kind: 'rapid_rise',
    enabled: false,
    thresholdMgdl: null,
    sustainMin: 0,
    cooldownMin: 30,
    quietStart: null,
    quietEnd: null,
  },
  {
    kind: 'stale',
    enabled: true,
    thresholdMgdl: null,
    sustainMin: 20,
    cooldownMin: 60,
    quietStart: null,
    quietEnd: null,
  },
  {
    kind: 'sensor_ending',
    enabled: true,
    thresholdMgdl: null,
    sustainMin: 1440,
    cooldownMin: 1440,
    quietStart: null,
    quietEnd: null,
  },
];
