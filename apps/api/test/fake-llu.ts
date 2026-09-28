import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { LluError } from '../src/llu/errors.js';
import type {
  ConnectionsResponse,
  GraphResponse,
  LluApi,
  LluMeasurement,
  LluSession,
  LogbookResponse,
} from '../src/llu/types.js';

dayjs.extend(utc);

export const fts = (ms: number) => dayjs.utc(ms).format('M/D/YYYY h:mm:ss A');
export const meas = (ms: number, mgdl: number, trend?: number): LluMeasurement => ({
  FactoryTimestamp: fts(ms),
  ValueInMgPerDl: mgdl,
  ...(trend ? { TrendArrow: trend } : {}),
});

/** Test için kontrol edilebilir LibreLinkUp istemcisi. */
export class FakeLlu implements LluApi {
  readonly version = 'fake';
  current: { ms: number; mgdl: number; trend: number } = { ms: Date.now(), mgdl: 100, trend: 3 };
  sensor = { sn: 'SN1', a: Math.floor(Date.now() / 1000) - 3 * 86400, pt: 4 };
  graphPoints: Array<[number, number]> = [];
  logbookPoints: Array<[number, number, number | null]> = [];
  fail: LluError | null = null;
  calls = { connections: 0, graph: 0, logbook: 0, login: 0 };
  session: LluSession | null = null;

  getSession() {
    return this.session;
  }
  async login() {
    this.calls.login++;
    if (this.fail) throw this.fail;
    this.session = {
      region: 'eu',
      userId: 'u',
      token: 't',
      expires: Math.floor(Date.now() / 1000) + 86400 * 30,
    };
    return this.session;
  }
  async ensureSession() {
    return this.session ?? this.login();
  }
  async connections(): Promise<ConnectionsResponse> {
    this.calls.connections++;
    if (this.fail) throw this.fail;
    return {
      status: 0,
      data: [
        {
          patientId: 'ext-p1',
          firstName: 'Fake',
          lastName: 'Patient',
          targetLow: 70,
          targetHigh: 180,
          sensor: this.sensor,
          glucoseMeasurement: meas(this.current.ms, this.current.mgdl, this.current.trend),
        },
      ],
    };
  }
  async graph(): Promise<GraphResponse> {
    this.calls.graph++;
    return {
      status: 0,
      data: { activeSensors: [], graphData: this.graphPoints.map(([ms, v]) => meas(ms, v)) },
    };
  }
  async logbook(): Promise<LogbookResponse> {
    this.calls.logbook++;
    return {
      status: 0,
      data: this.logbookPoints.map(([ms, v, alarm]) => ({
        ...meas(ms, v, 3),
        ...(alarm !== null ? { alarmType: alarm } : {}),
      })),
    };
  }
}
