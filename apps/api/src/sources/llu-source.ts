import {
  parseMeasurement,
  type LluApi,
  type LluConnection,
  type LluMeasurement,
} from '../llu/index.js';
import type { GlucoseSource, SourceLogbookEntry, SourcePatient, SourceReading } from './types.js';

function parseAll(items: readonly LluMeasurement[]): SourceReading[] {
  return items.map(parseMeasurement).filter((r): r is SourceReading => r !== null);
}

function toPatient(c: LluConnection): SourcePatient {
  return {
    externalId: c.patientId,
    firstName: c.firstName,
    lastName: c.lastName,
    targetLow: c.targetLow ?? null,
    targetHigh: c.targetHigh ?? null,
    sensor: c.sensor
      ? {
          serial: c.sensor.sn,
          activatedAt: new Date(c.sensor.a * 1000),
          productType: c.sensor.pt ?? null,
        }
      : null,
    current: c.glucoseMeasurement ? parseMeasurement(c.glucoseMeasurement) : null,
  };
}

/** LibreLinkUp takipçi hesabını `GlucoseSource` olarak sunar. */
export class LluSource implements GlucoseSource {
  readonly kind = 'llu';

  constructor(private readonly client: LluApi) {}

  async listPatients(): Promise<SourcePatient[]> {
    const res = await this.client.connections();
    return res.data.map(toPatient);
  }

  async history(externalId: string): Promise<SourceReading[]> {
    const res = await this.client.graph(externalId);
    return parseAll(res.data.graphData);
  }

  async logbook(externalId: string): Promise<SourceLogbookEntry[]> {
    const res = await this.client.logbook(externalId);
    return res.data.flatMap((m) => {
      const r = parseMeasurement(m);
      if (!r) return [];
      const isAlarm = m.alarmType !== undefined && m.alarmType !== null;
      return [
        {
          ...r,
          kind: isAlarm ? 'alarm' : 'scan',
          alarmType: isAlarm ? (m.alarmType as number) : null,
        },
      ];
    });
  }
}
