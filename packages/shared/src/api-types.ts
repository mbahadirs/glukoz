import type { AlertKind, GlucoseUnit, NoteType, Role } from './constants.js';
import type { DailySummary, GlycemicEvent, GlucoseReport, TimeInRanges } from './metrics-types.js';

/** REST API DTO sözleşmesi — zamanlar ISO 8601 UTC string. */

export interface ApiError {
  error: { code: string; message: string };
}

export interface PatientSummary {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  timezone: string;
  targetLow: number;
  targetHigh: number;
  lluTargetLow: number | null;
  lluTargetHigh: number | null;
  sensorLifeDays: number;
  canEdit: boolean;
  last: { ts: string; mgdl: number; trend: number | null } | null;
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: Role;
    locale: string;
    unit: GlucoseUnit;
    theme: 'system' | 'light' | 'dark';
    consentVersion: string | null;
  };
  requiredConsentVersion: string;
  patients: PatientSummary[];
  csrfToken: string;
}

export interface SensorInfo {
  id: string;
  serial: string;
  productType: number | null;
  activatedAt: string;
  expectedEnd: string;
  endedAt: string | null;
}

export interface CurrentResponse {
  patientId: string;
  reading: { ts: string; mgdl: number; trend: number | null } | null;
  /** son değer − ~5 dk önceki değer (mg/dL) */
  delta: number | null;
  ageSec: number | null;
  sensor: (SensorInfo & { remainingSec: number }) | null;
  today: {
    tir: TimeInRanges | null;
    mean: number | null;
    hypoCount: number;
    min: number | null;
    max: number | null;
  };
  lastFetchAt: string | null;
}

export interface ReadingDto {
  ts: string;
  mgdl: number;
  trend: number | null;
  source: 'current' | 'graph' | 'logbook' | 'import';
}

export interface NoteDto {
  id: string;
  patientId: string;
  authorId: string;
  ts: string;
  type: NoteType;
  carbsG: number | null;
  insulinU: number | null;
  durationMin: number | null;
  waterMl: number | null;
  text: string | null;
  createdAt: string;
}

export interface DayResponse {
  date: string;
  timezone: string;
  from: string;
  to: string;
  readings: Array<[number, number]>; // [ms, mgdl] ham ölçümler
  notes: NoteDto[];
  events: GlycemicEvent[];
  summary: DailySummary & { gmiPercent: number | null };
}

export type ReportResponse = GlucoseReport;

export interface AlertRuleDto {
  id: string;
  kind: AlertKind;
  enabled: boolean;
  thresholdMgdl: number | null;
  sustainMin: number;
  cooldownMin: number;
  quietStart: string | null;
  quietEnd: string | null;
}

export interface AlertEventDto {
  id: string;
  ruleId: string;
  kind: AlertKind | null;
  patientId: string;
  firedAt: string;
  mgdl: number | null;
  message: string;
  ackBy: string | null;
  ackAt: string | null;
}

export interface LluAccountDto {
  id: string;
  label: string;
  emailMasked: string;
  region: string | null;
  status: 'active' | 'paused' | 'error';
  lastError: string | null;
  failCount: number;
  patientCount: number;
  createdAt: string;
}

export interface SystemStatusResponse {
  llu: { product: string; version: string; mock: boolean; minimumVersionSeen: string | null };
  accounts: Array<{
    id: string;
    label: string;
    status: string;
    lastError: string | null;
    lastSuccessAt: string | null;
    successRate24h: number | null;
    runs24h: number;
    lastErrorCode: string | null;
  }>;
}

export interface AdminUserDto {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: string;
  access: Array<{ patientId: string; canEdit: boolean }>;
}

export interface LogbookEntryDto {
  ts: string;
  mgdl: number;
  kind: 'scan' | 'alarm';
  alarmType: number | null;
}

/** SSE olay yükleri */
export type StreamEvent =
  | {
      type: 'reading';
      patientId: string;
      reading: { ts: string; mgdl: number; trend: number | null };
    }
  | { type: 'alert'; patientId: string; alert: AlertEventDto }
  | { type: 'status'; accountId: string; ok: boolean; errorCode: string | null; at: string };

export interface SetupStatusResponse {
  needsSetup: boolean;
}

/** GET /api/patients/:id/readings — [ms UTC, mg/dL] */
export interface ReadingsResponse {
  resolution: 'raw' | '5m';
  points: Array<[number, number]>;
}

export interface SensorHistoryDto extends SensorInfo {
  usedDays: number;
  sufficiencyPercent: number;
  endedEarly: boolean;
  active: boolean;
}

export interface ImportResponse {
  imported: number;
  skipped: number;
  rows: number;
}

export interface DeleteDataStep1Response {
  confirmToken: string;
  expiresInSec: number;
  confirmName: string;
}

export interface LluAccountCreateResponse {
  account: LluAccountDto;
  patients: string[];
}

export interface LluAccountTestResponse {
  ok: boolean;
  patients: number;
  errorCode: string | null;
  message: string | null;
}
