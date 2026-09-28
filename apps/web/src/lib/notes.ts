import type { NoteDto, NoteType } from '@glukoz/shared';

type T = (k: string, o?: Record<string, unknown>) => string;

/** Giriş kategorileri — hızlı giriş ekranı ve grafik katmanları bunları kullanır. */
export type EntryCategory = 'insulin' | 'meal' | 'water' | 'sleep' | 'other';

export const ENTRY_CATEGORIES: readonly EntryCategory[] = [
  'insulin',
  'meal',
  'water',
  'sleep',
  'other',
];

export const CATEGORY_ICON: Record<EntryCategory, string> = {
  insulin: '💉',
  meal: '🍽',
  water: '💧',
  sleep: '🌙',
  other: '📝',
};

export const OTHER_TYPES: readonly NoteType[] = ['exercise', 'medication', 'illness', 'other'];

export function categoryOf(type: NoteType): EntryCategory {
  if (type === 'insulin_rapid' || type === 'insulin_basal') return 'insulin';
  if (type === 'meal' || type === 'water' || type === 'sleep') return type;
  return 'other';
}

/** Girişin kısa ayrıntıları: "45 g", "4 U", "330 ml", "7 sa 30 dk". */
export function noteDetails(
  n: Pick<NoteDto, 'carbsG' | 'insulinU' | 'durationMin' | 'waterMl' | 'type'>,
  t: T,
): string[] {
  const out: string[] = [];
  if (n.carbsG !== null) out.push(`${n.carbsG} g`);
  if (n.insulinU !== null) out.push(`${n.insulinU} U`);
  if (n.waterMl !== null) out.push(`${n.waterMl} ml`);
  if (n.durationMin !== null) {
    const h = Math.floor(n.durationMin / 60);
    const m = n.durationMin % 60;
    out.push(h ? t('units.hoursMinutes', { h, m }) : t('units.minutes', { count: m }));
  } else if (n.type === 'sleep') {
    out.push(t('entry.sleepOngoing'));
  }
  return out;
}
