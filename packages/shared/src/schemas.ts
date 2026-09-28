import { z } from 'zod';
import { ALERT_KINDS, NOTE_TYPES, ROLES } from './constants.js';

/** İstek gövdesi / sorgu şemaları — API doğrular, web form doğrulamasında yeniden kullanır. */

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD bekleniyor');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'SS:DD bekleniyor');

export const passwordSchema = z.string().min(10, 'Şifre en az 10 karakter olmalı').max(200);

export const loginBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

export const setupBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(100),
});

export const preferencesBody = z
  .object({
    unit: z.enum(['mgdl', 'mmol']),
    locale: z.enum(['tr', 'en']),
    theme: z.enum(['system', 'light', 'dark']),
    displayName: z.string().trim().min(1).max(100),
  })
  .partial();

export const consentBody = z.object({ version: z.string().min(1).max(20) });

export const adminUserCreate = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(100),
  role: z.enum(ROLES),
  access: z.array(z.object({ patientId: z.string().uuid(), canEdit: z.boolean() })).default([]),
});

export const adminUserUpdate = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    role: z.enum(ROLES),
    password: passwordSchema,
    access: z.array(z.object({ patientId: z.string().uuid(), canEdit: z.boolean() })),
  })
  .partial();

export const lluAccountCreate = z.object({
  label: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
});

export const patientUpdate = z
  .object({
    displayName: z.string().trim().max(100).nullable(),
    targetLow: z.number().int().min(54).max(120),
    targetHigh: z.number().int().min(120).max(300),
    timezone: z.string().min(1).max(64),
    sensorLifeDays: z.number().int().min(7).max(21),
  })
  .partial()
  .refine(
    (v) => v.targetLow === undefined || v.targetHigh === undefined || v.targetLow < v.targetHigh,
    {
      message: 'Alt hedef üst hedeften küçük olmalı',
    },
  );

/** ISO tarih-saat veya ms (sayı/sayısal string) kabul eder. */
export const dateParam = z.preprocess(
  (v) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v),
  z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), 'Geçersiz tarih'),
);

export const rangeQuery = z
  .object({ from: dateParam, to: dateParam })
  .refine((v) => v.from < v.to, { message: '`from`, `to` değerinden önce olmalı' });

export const readingsQuery = z
  .object({ from: dateParam, to: dateParam, resolution: z.enum(['raw', '5m']).default('5m') })
  .refine((v) => v.from < v.to, { message: '`from`, `to` değerinden önce olmalı' });

export const dayQuery = z.object({ date: isoDate });

export const eventsQuery = z
  .object({
    from: dateParam,
    to: dateParam,
    type: z.enum(['hypo_l1', 'hypo_l2', 'hyper']).optional(),
  })
  .refine((v) => v.from < v.to, { message: '`from`, `to` değerinden önce olmalı' });

export const noteBody = z.object({
  ts: dateParam,
  type: z.enum(NOTE_TYPES),
  carbsG: z.number().int().min(0).max(1000).nullable().optional(),
  insulinU: z.number().min(0).max(300).nullable().optional(),
  durationMin: z.number().int().min(0).max(1440).nullable().optional(),
  waterMl: z.number().int().min(1).max(5000).nullable().optional(),
  text: z.string().trim().max(1000).nullable().optional(),
});

export const noteUpdate = noteBody.partial();

export const alertRuleUpdate = z.object({
  kind: z.enum(ALERT_KINDS),
  enabled: z.boolean(),
  thresholdMgdl: z.number().int().min(30).max(400).nullable(),
  sustainMin: z.number().int().min(0).max(240),
  cooldownMin: z.number().int().min(0).max(1440),
  quietStart: hhmm.nullable(),
  quietEnd: hhmm.nullable(),
});

export const alertRulesPut = z.object({ rules: z.array(alertRuleUpdate).max(ALERT_KINDS.length) });

export const pushSubscribeBody = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export const pushUnsubscribeBody = z.object({ endpoint: z.string().url().max(2000) });

export const deleteDataBody = z.object({
  /** iki aşamalı onay: önce token al, sonra token + hasta adıyla onayla */
  confirmToken: z.string().optional(),
  confirmName: z.string().optional(),
});
