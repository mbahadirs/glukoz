import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { LluError } from './errors.js';
import { glucoseAt, isGap, lastValidMinute, trendAt, type SyntheticProfile } from './synthetic.js';
import type {
  ConnectionsResponse,
  GraphResponse,
  LluApi,
  LluConnection,
  LluMeasurement,
  LluSession,
  LogbookResponse,
} from './types.js';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Sahte LibreLinkUp istemcisi — gerçek istemciyle aynı arayüz, ağ çağrısı yok.
 * 2 hasta; A'nın sensörü 1 günden kısa sürede biter (uyarı testi için).
 */

export type MockFailMode = 'none' | '401' | '429' | '920' | 'network';

const DAY = 86_400_000;
const SENSOR_LIFE = 15 * DAY;
const TZ = 'Europe/Istanbul';

export interface MockPatient {
  patientId: string;
  firstName: string;
  lastName: string;
  profile: SyntheticProfile;
  /** mevcut sensörün aktivasyon anı (ms) */
  sensorEpoch: number;
  serialPrefix: string;
}

export function mockPatients(now = Date.now()): MockPatient[] {
  return [
    {
      patientId: '00000000-0000-4000-8000-00000000000a',
      firstName: 'Deneme Hasta',
      lastName: 'A',
      profile: { id: 'A', seed: 11, base: 110, mealScale: 1, timezone: TZ },
      sensorEpoch: now - 14.3 * DAY,
      serialPrefix: 'MOCKA',
    },
    {
      patientId: '00000000-0000-4000-8000-00000000000b',
      firstName: 'Deneme Hasta',
      lastName: 'B',
      profile: { id: 'B', seed: 29, base: 128, mealScale: 1.25, timezone: TZ },
      sensorEpoch: now - 5 * DAY,
      serialPrefix: 'MOCKB',
    },
  ];
}

/** Belirli andaki sensör (geçmişe doğru 15 günlük döngü). */
export function mockSensorAt(p: MockPatient, ts: number): { sn: string; a: number; pt: number } {
  const index = Math.floor((ts - p.sensorEpoch) / SENSOR_LIFE);
  const activation = p.sensorEpoch + index * SENSOR_LIFE;
  return {
    sn: `${p.serialPrefix}${String(index + 100).padStart(4, '0')}`,
    a: Math.floor(activation / 1000),
    pt: 4,
  };
}

export function mockMeasurement(p: MockPatient, ts: number, withTrend: boolean): LluMeasurement {
  const mgdl = glucoseAt(p.profile, ts);
  return {
    FactoryTimestamp: dayjs.utc(ts).format('M/D/YYYY h:mm:ss A'),
    Timestamp: dayjs.utc(ts).tz(TZ).format('M/D/YYYY h:mm:ss A'),
    ValueInMgPerDl: mgdl,
    Value: mgdl,
    GlucoseUnits: 1,
    MeasurementColor: 1,
    isHigh: false,
    isLow: false,
    type: withTrend ? 1 : 0,
    ...(withTrend ? { TrendArrow: trendAt(p.profile, ts) } : {}),
  };
}

export class MockLluClient implements LluApi {
  private session: LluSession | null = null;
  private readonly patients: MockPatient[];

  constructor(
    private readonly failMode: MockFailMode = 'none',
    private readonly now: () => number = Date.now,
    patients?: MockPatient[],
  ) {
    this.patients = patients ?? mockPatients(now());
  }

  readonly version = 'mock';

  private maybeFail(): void {
    switch (this.failMode) {
      case '401':
        throw new LluError('LLU_UNAUTHORIZED', '[mock] LibreLinkUp oturumu reddedildi', {
          httpStatus: 401,
        });
      case '429':
        throw new LluError('LLU_RATE_LIMITED', '[mock] istek sınırı', { httpStatus: 429 });
      case '920':
        throw new LluError('LLU_VERSION_TOO_OLD', '[mock] sürüm eski', {
          minimumVersion: '9.9.9',
          httpStatus: 403,
        });
      case 'network':
        throw new LluError('LLU_NETWORK', '[mock] ağ hatası');
      default:
    }
  }

  getSession(): LluSession | null {
    return this.session;
  }

  async login(): Promise<LluSession> {
    this.maybeFail();
    this.session = {
      region: 'eu',
      userId: 'mock-user',
      token: 'mock-token',
      expires: Math.floor(this.now() / 1000) + 30 * 86_400,
    };
    return this.session;
  }

  async ensureSession(): Promise<LluSession> {
    return this.session ?? this.login();
  }

  private connection(p: MockPatient): LluConnection {
    const ts = lastValidMinute(p.profile, this.now());
    return {
      patientId: p.patientId,
      firstName: p.firstName,
      lastName: p.lastName,
      targetLow: 70,
      targetHigh: 180,
      uom: 1,
      sensor: mockSensorAt(p, ts),
      glucoseMeasurement: mockMeasurement(p, ts, true),
    };
  }

  private find(patientId: string): MockPatient {
    const p = this.patients.find((x) => x.patientId === patientId);
    if (!p) throw new LluError('LLU_HTTP', '[mock] hasta bulunamadı', { httpStatus: 404 });
    return p;
  }

  async connections(): Promise<ConnectionsResponse> {
    await this.ensureSession();
    this.maybeFail();
    return { status: 0, data: this.patients.map((p) => this.connection(p)) };
  }

  async graph(patientId: string): Promise<GraphResponse> {
    await this.ensureSession();
    this.maybeFail();
    const p = this.find(patientId);
    const step = 15 * 60_000;
    const end = this.now() - (this.now() % step);
    const graphData: LluMeasurement[] = [];
    for (let t = end - 12 * 3600_000; t <= end; t += step) {
      if (!isGap(p.profile, t)) graphData.push(mockMeasurement(p, t, false));
    }
    return {
      status: 0,
      data: {
        connection: this.connection(p),
        activeSensors: [{ sensor: mockSensorAt(p, this.now()) }],
        graphData,
      },
    };
  }

  async logbook(patientId: string): Promise<LogbookResponse> {
    await this.ensureSession();
    this.maybeFail();
    const p = this.find(patientId);
    const data: LluMeasurement[] = [];
    const start = this.now() - 14 * DAY;
    for (let d = 0; d < 14; d++) {
      for (const minute of [7 * 60 + 40, 12 * 60 + 50, 18 * 60 + 10, 22 * 60 + 30]) {
        const ts = Math.floor((start + d * DAY) / DAY) * DAY + (minute - 180) * 60_000;
        if (ts > this.now() || isGap(p.profile, ts)) continue;
        const m = mockMeasurement(p, ts, true);
        data.push(m.ValueInMgPerDl < 70 ? { ...m, alarmType: 0 } : m);
      }
    }
    return { status: 0, data };
  }
}
