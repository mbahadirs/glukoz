import { z } from 'zod';

/**
 * LibreLinkUp yanıt şemaları. Resmi değildir — bilinmeyen alanlara tolerans (`passthrough`),
 * kullanılan alanlar doğrulanır.
 */

export const LLU_HOSTS = {
  global: 'https://api.libreview.io',
  us: 'https://api-us.libreview.io',
  eu: 'https://api-eu.libreview.io',
  eu2: 'https://api-eu2.libreview.io',
  de: 'https://api-de.libreview.io',
  fr: 'https://api-fr.libreview.io',
  jp: 'https://api-jp.libreview.io',
  ap: 'https://api-ap.libreview.io',
  au: 'https://api-au.libreview.io',
  ae: 'https://api-ae.libreview.io',
  ca: 'https://api-ca.libreview.io',
  la: 'https://api-la.libreview.io',
} as const;

export type LluRegion = keyof typeof LLU_HOSTS;

export function hostFor(region: string): string {
  const r = region.toLowerCase();
  if (r in LLU_HOSTS) return LLU_HOSTS[r as LluRegion];
  if (!/^[a-z0-9]{2,5}$/.test(r)) throw new Error('Geçersiz LLU bölge kodu');
  return `https://api-${r}.libreview.io`;
}

export function regionOf(host: string): string {
  const entry = Object.entries(LLU_HOSTS).find(([, h]) => h === host);
  if (entry) return entry[0];
  const m = /^https:\/\/api-([a-z0-9]+)\.libreview\.io$/.exec(host);
  return m?.[1] ?? 'global';
}

export const TicketSchema = z
  .object({ token: z.string().min(1), expires: z.number(), duration: z.number().optional() })
  .passthrough();

export const MeasurementSchema = z
  .object({
    FactoryTimestamp: z.string().min(1),
    Timestamp: z.string().optional(),
    ValueInMgPerDl: z.number(),
    TrendArrow: z.number().int().optional().nullable(),
    MeasurementColor: z.number().optional(),
    GlucoseUnits: z.number().optional(),
    Value: z.number().optional(),
    isHigh: z.boolean().optional(),
    isLow: z.boolean().optional(),
    type: z.number().optional(),
    alarmType: z.number().optional().nullable(),
  })
  .passthrough();
export type LluMeasurement = z.infer<typeof MeasurementSchema>;

export const SensorSchema = z
  .object({ sn: z.string().min(1), a: z.number(), pt: z.number().optional() })
  .passthrough();

export const ConnectionSchema = z
  .object({
    patientId: z.string().min(1),
    firstName: z.string().default(''),
    lastName: z.string().default(''),
    targetLow: z.number().optional(),
    targetHigh: z.number().optional(),
    uom: z.number().optional(),
    sensor: SensorSchema.optional().nullable(),
    glucoseMeasurement: MeasurementSchema.optional().nullable(),
  })
  .passthrough();
export type LluConnection = z.infer<typeof ConnectionSchema>;

const Envelope = z.object({ status: z.number(), ticket: TicketSchema.optional() }).passthrough();

export const ConnectionsResponseSchema = Envelope.extend({ data: z.array(ConnectionSchema) });
export type ConnectionsResponse = z.infer<typeof ConnectionsResponseSchema>;

export const GraphResponseSchema = Envelope.extend({
  data: z
    .object({
      connection: ConnectionSchema.optional().nullable(),
      activeSensors: z
        .array(z.object({ sensor: SensorSchema.optional().nullable() }).passthrough())
        .optional()
        .default([]),
      graphData: z.array(MeasurementSchema).default([]),
    })
    .passthrough(),
});
export type GraphResponse = z.infer<typeof GraphResponseSchema>;

export const LogbookResponseSchema = Envelope.extend({ data: z.array(MeasurementSchema) });
export type LogbookResponse = z.infer<typeof LogbookResponseSchema>;

export const LoginResponseSchema = z
  .object({
    status: z.number(),
    data: z
      .object({
        redirect: z.boolean().optional(),
        region: z.string().optional(),
        user: z
          .object({ id: z.string().min(1) })
          .passthrough()
          .optional(),
        authTicket: TicketSchema.optional(),
        step: z.unknown().optional(),
        minimumVersion: z.string().optional(),
      })
      .passthrough()
      .optional()
      .nullable(),
  })
  .passthrough();

export interface LluSession {
  region: string;
  userId: string;
  token: string;
  /** unix saniye */
  expires: number;
}

/** Gerçek ve sahte istemcinin ortak arayüzü. */
export interface LluApi {
  login(): Promise<LluSession>;
  ensureSession(): Promise<LluSession>;
  getSession(): LluSession | null;
  connections(): Promise<ConnectionsResponse>;
  graph(patientId: string): Promise<GraphResponse>;
  logbook(patientId: string): Promise<LogbookResponse>;
  readonly version: string;
}
