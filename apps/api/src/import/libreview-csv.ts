import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import { MGDL_PER_MMOL } from '@glukoz/shared';
import { detectDelimiter, parseCsv } from './csv.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

/**
 * LibreView "Glukoz verisi" CSV dışa aktarımını ayrıştırır. Başlık dili ve tarih biçimi değişebilir;
 * sütunlar esnek eşlenir. Cihaz zaman damgası yerel saattir → hasta saat dilimiyle UTC'ye çevrilir.
 */

export interface ImportedReading {
  ts: Date;
  mgdl: number;
  trend: null;
  deviceLocalTs: string;
}

export interface ParseResult {
  readings: ImportedReading[];
  rows: number;
  skipped: number;
}

const COLUMN_PATTERNS = {
  timestamp: /time ?stamp|zaman damga|zeitstempel|horodatage|marca de tiempo/i,
  recordType:
    /record type|kay[ıi]t t[üu]r|kay[ıi]t tip|aufzeichnungstyp|type d'enregistrement|tipo de registro/i,
  historic: /(historic|ge[çc]mi[şs]|verlauf|historique|hist[óo]ric)/i,
  scan: /(scan|tarama|taranan)/i,
  glucose: /glu/i,
};

const DATE_FORMATS = [
  'MM-DD-YYYY HH:mm',
  'DD-MM-YYYY HH:mm',
  'YYYY-MM-DD HH:mm',
  'DD.MM.YYYY HH:mm',
  'MM/DD/YYYY HH:mm',
  'DD/MM/YYYY HH:mm',
  'YYYY-MM-DD HH:mm:ss',
  'M/D/YYYY h:mm A',
  'MM-DD-YYYY hh:mm A',
];

interface Columns {
  timestamp: number;
  recordType: number;
  historic: number;
  scan: number;
  mmol: { historic: boolean; scan: boolean };
}

function findHeader(rows: string[][]): { index: number; cols: Columns } | null {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const h = rows[i] ?? [];
    const timestamp = h.findIndex((c) => COLUMN_PATTERNS.timestamp.test(c));
    const historic = h.findIndex(
      (c) => COLUMN_PATTERNS.historic.test(c) && COLUMN_PATTERNS.glucose.test(c),
    );
    const scan = h.findIndex(
      (c) => COLUMN_PATTERNS.scan.test(c) && COLUMN_PATTERNS.glucose.test(c),
    );
    if (timestamp >= 0 && (historic >= 0 || scan >= 0)) {
      return {
        index: i,
        cols: {
          timestamp,
          recordType: h.findIndex((c) => COLUMN_PATTERNS.recordType.test(c)),
          historic,
          scan,
          mmol: { historic: /mmol/i.test(h[historic] ?? ''), scan: /mmol/i.test(h[scan] ?? '') },
        },
      };
    }
  }
  return null;
}

/** Tarih biçimini seç: örneklerin tümünü ayrıştıran ve zaman serisi en tutarlı olan biçim. */
export function detectDateFormat(samples: readonly string[]): string | null {
  let best: { fmt: string; score: number } | null = null;
  for (const fmt of DATE_FORMATS) {
    const parsed = samples.map((s) => dayjs(s, fmt, true));
    if (!parsed.every((d) => d.isValid())) continue;
    let smooth = 0;
    for (let i = 1; i < parsed.length; i++) {
      if (Math.abs((parsed[i] as dayjs.Dayjs).diff(parsed[i - 1] as dayjs.Dayjs, 'hour')) <= 24)
        smooth++;
    }
    const score = parsed.length > 1 ? smooth / (parsed.length - 1) : 1;
    if (!best || score > best.score) best = { fmt, score };
  }
  return best?.fmt ?? null;
}

function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseLibreViewCsv(text: string, tz: string): ParseResult {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLines = clean.split(/\r?\n/).slice(0, 3);
  const delimiter = detectDelimiter(firstLines[1] ?? firstLines[0] ?? '');
  const rows = parseCsv(clean, delimiter);
  const header = findHeader(rows);
  if (!header)
    throw new Error('CSV başlığı tanınamadı (zaman damgası ve glukoz sütunları bulunamadı).');
  const { cols } = header;
  const data = rows.slice(header.index + 1).filter((r) => r.some((c) => c.trim() !== ''));
  const samples = data
    .map((r) => (r[cols.timestamp] ?? '').trim())
    .filter(Boolean)
    .slice(0, 300);
  const fmt = detectDateFormat(samples);
  if (!fmt) throw new Error('Tarih biçimi tanınamadı.');

  const readings: ImportedReading[] = [];
  let skipped = 0;
  for (const r of data) {
    const type = cols.recordType >= 0 ? (r[cols.recordType] ?? '').trim() : '';
    const useScan = type === '1' || (type === '' && cols.historic < 0);
    if (type !== '' && type !== '0' && type !== '1') {
      skipped++;
      continue;
    }
    const col = useScan ? cols.scan : cols.historic;
    const raw = col >= 0 ? toNumber(r[col]) : null;
    const stamp = (r[cols.timestamp] ?? '').trim();
    const local = dayjs(stamp, fmt, true);
    if (raw === null || !local.isValid()) {
      skipped++;
      continue;
    }
    const mmol = useScan ? cols.mmol.scan : cols.mmol.historic;
    const mgdl = Math.round(mmol ? raw * MGDL_PER_MMOL : raw);
    const ts = dayjs.tz(local.format('YYYY-MM-DD HH:mm:ss'), 'YYYY-MM-DD HH:mm:ss', tz);
    readings.push({ ts: ts.toDate(), mgdl, trend: null, deviceLocalTs: stamp });
  }
  return { readings, rows: data.length, skipped };
}
