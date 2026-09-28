/**
 * Veri kaynağı soyutlaması — ileride Nightscout/Juggluco kaynakları eklenebilir.
 * Collector yalnızca bu arayüzü bilir.
 */

export interface SourceReading {
  ts: Date;
  mgdl: number;
  trend: number | null;
  deviceLocalTs: string | null;
}

export interface SourceLogbookEntry extends SourceReading {
  kind: 'scan' | 'alarm';
  alarmType: number | null;
}

export interface SourceSensor {
  serial: string;
  activatedAt: Date;
  productType: number | null;
}

export interface SourcePatient {
  externalId: string;
  firstName: string;
  lastName: string;
  targetLow: number | null;
  targetHigh: number | null;
  sensor: SourceSensor | null;
  current: SourceReading | null;
}

export interface GlucoseSource {
  readonly kind: string;
  listPatients(): Promise<SourcePatient[]>;
  history(externalId: string): Promise<SourceReading[]>;
  logbook(externalId: string): Promise<SourceLogbookEntry[]>;
}
