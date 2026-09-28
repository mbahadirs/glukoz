import type { NoteDto, NoteType } from '@glukoz/shared';
import dayjs from '../lib/dayjs';
import { categoryOf, type EntryCategory } from '../lib/notes';
import type { NoteInput } from '../lib/queries';

/** Hızlı giriş formunun durumu ve saf dönüşümleri (bileşenden ayrı, test edilebilir). */

export type TimeMode = 'now' | 'custom';
const FMT = 'YYYY-MM-DDTHH:mm';

export interface EntryForm {
  category: EntryCategory;
  type: NoteType;
  mode: TimeMode;
  ts: string;
  sleepEnd: string;
  carbsG: string;
  insulinU: string;
  waterMl: string;
  durationMin: string;
  text: string;
}

export const DEFAULT_TYPE: Record<EntryCategory, NoteType> = {
  insulin: 'insulin_rapid',
  meal: 'meal',
  water: 'water',
  sleep: 'sleep',
  other: 'exercise',
};

export function initialForm(
  note: NoteDto | null | undefined,
  tz: string,
  type: NoteType,
  now = Date.now(),
): EntryForm {
  const start = note ? Date.parse(note.ts) : now;
  const end = note?.durationMin ? start + note.durationMin * 60_000 : now;
  return {
    category: categoryOf(note?.type ?? type),
    type: note?.type ?? type,
    mode: note ? 'custom' : 'now',
    ts: dayjs(start).tz(tz).format(FMT),
    sleepEnd: dayjs(end).tz(tz).format(FMT),
    carbsG: note?.carbsG?.toString() ?? '',
    insulinU: note?.insulinU?.toString() ?? '',
    waterMl: note?.waterMl?.toString() ?? '',
    durationMin: note?.durationMin?.toString() ?? '',
    text: note?.text ?? '',
  };
}

const num = (v: string): number | null => {
  const s = v.trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

export type EntryError = 'insulinRequired' | 'waterRequired' | 'sleepRange' | 'invalidNumber';

/** Formu API girdisine çevirir; yalnızca kategoriyle ilgili alanlar gönderilir. */
export function toInput(f: EntryForm, tz: string, now = Date.now()): NoteInput | EntryError {
  const tsMs = f.mode === 'now' ? now : dayjs.tz(f.ts, FMT, tz).valueOf();
  const base: NoteInput = {
    ts: new Date(tsMs).toISOString(),
    type: f.type,
    carbsG: null,
    insulinU: null,
    durationMin: null,
    waterMl: null,
    text: f.text.trim() || null,
  };
  switch (f.category) {
    case 'insulin': {
      const u = num(f.insulinU);
      if (u === null || Number.isNaN(u) || u <= 0) return 'insulinRequired';
      return { ...base, insulinU: u };
    }
    case 'meal': {
      const c = num(f.carbsG);
      if (Number.isNaN(c)) return 'invalidNumber';
      return { ...base, carbsG: c === null ? null : Math.round(c) };
    }
    case 'water': {
      const w = num(f.waterMl);
      if (w === null || Number.isNaN(w) || w <= 0) return 'waterRequired';
      return { ...base, waterMl: Math.round(w) };
    }
    case 'sleep': {
      if (f.mode === 'now') return base; // şimdi uyuyor — süre sonra düzenlenir
      const end = dayjs.tz(f.sleepEnd, FMT, tz).valueOf();
      const minutes = Math.round((end - tsMs) / 60_000);
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) return 'sleepRange';
      return { ...base, durationMin: minutes };
    }
    default: {
      const d = num(f.durationMin);
      if (Number.isNaN(d)) return 'invalidNumber';
      return { ...base, durationMin: d === null ? null : Math.round(d) };
    }
  }
}
