import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { NoteDto, NoteType } from '@glukoz/shared';
import dayjs from '../lib/dayjs';
import { CATEGORY_ICON, ENTRY_CATEGORIES, OTHER_TYPES, type EntryCategory } from '../lib/notes';
import { useSaveNote } from '../lib/queries';
import { DEFAULT_TYPE, initialForm, toInput, type EntryError, type EntryForm } from './entryForm';
import { ErrorBox } from './ui';

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  tz: string;
  note?: NoteDto | null;
  defaultType?: NoteType;
}

const WATER_PRESETS = [200, 250, 330, 500];

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** Hızlı giriş: insülin, yemek, su, uyku (+ diğer) — şimdi ya da belirli bir zaman için. */
export function NoteDialog({ open, onClose, patientId, tz, note, defaultType = 'meal' }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const save = useSaveNote(patientId);
  const [form, setForm] = useState<EntryForm>(() => initialForm(note, tz, defaultType));
  const [error, setError] = useState<EntryError | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initialForm(note, tz, defaultType));
      setError(null);
      save.reset();
      if (!ref.current?.open) ref.current?.showModal?.();
    } else ref.current?.close?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, note, tz, defaultType]);

  const set =
    (k: keyof EntryForm) =>
    (e: { target: { value: string } }): void =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  const setCategory = (category: EntryCategory) =>
    setForm((f) => ({ ...f, category, type: DEFAULT_TYPE[category] }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input = toInput(form, tz);
    if (typeof input === 'string') {
      setError(input);
      return;
    }
    setError(null);
    await save.mutateAsync({ id: note?.id, input });
    onClose();
  };

  const c = form.category;
  const nowLabel = dayjs().tz(tz).format('HH:mm');

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="entry-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-border bg-bg p-0 text-text backdrop:bg-black/50"
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-3 p-4">
        <h2 id="entry-title" className="text-lg font-semibold">
          {note ? t('notes.edit') : t('notes.add')}
        </h2>

        <div role="radiogroup" aria-label={t('notes.type')} className="grid grid-cols-5 gap-1">
          {ENTRY_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              role="radio"
              aria-checked={c === cat}
              className="chip flex flex-col items-center gap-0.5 py-2"
              onClick={() => setCategory(cat)}
            >
              <span aria-hidden="true" className="text-xl">
                {CATEGORY_ICON[cat]}
              </span>
              <span className="text-xs">{t(`entry.categories.${cat}`)}</span>
            </button>
          ))}
        </div>

        {(c === 'insulin' || c === 'other') && (
          <Field id="entry-subtype" label={t('entry.subtype')}>
            <select id="entry-subtype" className="input" value={form.type} onChange={set('type')}>
              {(c === 'insulin'
                ? (['insulin_rapid', 'insulin_basal'] as NoteType[])
                : OTHER_TYPES
              ).map((nt) => (
                <option key={nt} value={nt}>
                  {t(`noteTypes.${nt}`)}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div role="radiogroup" aria-label={t('entry.when')} className="grid grid-cols-2 gap-1">
          {(['now', 'custom'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={form.mode === m}
              className="chip justify-center text-center"
              onClick={() => setForm((f) => ({ ...f, mode: m }))}
            >
              {m === 'now'
                ? t(c === 'sleep' ? 'entry.sleepNow' : 'entry.now', { time: nowLabel })
                : t(c === 'sleep' ? 'entry.sleepRange' : 'entry.custom')}
            </button>
          ))}
        </div>

        {form.mode === 'custom' && (
          <div className={c === 'sleep' ? 'grid gap-2 sm:grid-cols-2' : ''}>
            <Field id="note-ts" label={t(c === 'sleep' ? 'entry.sleepStart' : 'notes.time')}>
              <input
                id="note-ts"
                type="datetime-local"
                required
                className="input"
                value={form.ts}
                onChange={set('ts')}
              />
            </Field>
            {c === 'sleep' && (
              <Field id="entry-sleep-end" label={t('entry.sleepEnd')}>
                <input
                  id="entry-sleep-end"
                  type="datetime-local"
                  required
                  className="input"
                  value={form.sleepEnd}
                  onChange={set('sleepEnd')}
                />
              </Field>
            )}
          </div>
        )}

        {c === 'insulin' && (
          <Field id="note-ins" label={t('entry.insulinUnits')}>
            <input
              id="note-ins"
              inputMode="decimal"
              className="input num"
              value={form.insulinU}
              onChange={set('insulinU')}
            />
          </Field>
        )}
        {c === 'meal' && (
          <Field id="note-carbs" label={t('notes.carbs')}>
            <input
              id="note-carbs"
              inputMode="numeric"
              className="input num"
              value={form.carbsG}
              onChange={set('carbsG')}
            />
          </Field>
        )}
        {c === 'water' && (
          <Field id="entry-water" label={t('entry.waterMl')}>
            <div className="flex flex-wrap gap-1 pb-1">
              {WATER_PRESETS.map((ml) => (
                <button
                  key={ml}
                  type="button"
                  className="chip"
                  aria-pressed={form.waterMl === String(ml)}
                  onClick={() => setForm((f) => ({ ...f, waterMl: String(ml) }))}
                >
                  {ml} ml
                </button>
              ))}
            </div>
            <input
              id="entry-water"
              inputMode="numeric"
              className="input num"
              value={form.waterMl}
              onChange={set('waterMl')}
            />
          </Field>
        )}
        {c === 'other' && (
          <Field id="note-dur" label={t('notes.duration')}>
            <input
              id="note-dur"
              inputMode="numeric"
              className="input num"
              value={form.durationMin}
              onChange={set('durationMin')}
            />
          </Field>
        )}

        <Field id="note-text" label={t('notes.text')}>
          <textarea
            id="note-text"
            className="input"
            rows={2}
            maxLength={1000}
            value={form.text}
            onChange={set('text')}
          />
        </Field>

        {error && (
          <p role="alert" className="text-sm font-medium text-[var(--g-low)]">
            {t(`entry.errors.${error}`)}
          </p>
        )}
        {save.error && <ErrorBox error={save.error} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
