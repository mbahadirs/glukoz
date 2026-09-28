import { describe, expect, it } from 'vitest';
import { initialForm, toInput, type EntryForm } from '../../src/components/entryForm';
import { categoryOf, noteDetails } from '../../src/lib/notes';

const TZ = 'Europe/Istanbul';
const NOW = Date.UTC(2026, 8, 27, 10, 0);
const t = (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k);
const form = (patch: Partial<EntryForm>): EntryForm => ({
  ...initialForm(null, TZ, 'meal', NOW),
  ...patch,
});

describe('hızlı giriş formu', () => {
  it('şimdi modunda zaman = şimdi; yalnızca ilgili alanlar gönderilir', () => {
    const r = toInput(
      form({ category: 'water', type: 'water', waterMl: '330', carbsG: '50' }),
      TZ,
      NOW,
    );
    expect(r).toMatchObject({
      ts: new Date(NOW).toISOString(),
      type: 'water',
      waterMl: 330,
      carbsG: null,
    });
  });

  it('belirli zaman hasta saat dilimine göre çevrilir', () => {
    const r = toInput(form({ mode: 'custom', ts: '2026-09-27T08:30', carbsG: '45' }), TZ, NOW);
    expect(r).toMatchObject({ ts: '2026-09-27T05:30:00.000Z', type: 'meal', carbsG: 45 });
  });

  it('insülin ve su zorunlu miktar ister; virgüllü ondalık kabul edilir', () => {
    expect(
      toInput(form({ category: 'insulin', type: 'insulin_rapid', insulinU: '' }), TZ, NOW),
    ).toBe('insulinRequired');
    expect(
      toInput(form({ category: 'insulin', type: 'insulin_basal', insulinU: '4,5' }), TZ, NOW),
    ).toMatchObject({ insulinU: 4.5, type: 'insulin_basal' });
    expect(toInput(form({ category: 'water', type: 'water', waterMl: '0' }), TZ, NOW)).toBe(
      'waterRequired',
    );
    expect(toInput(form({ carbsG: 'abc' }), TZ, NOW)).toBe('invalidNumber');
  });

  it('uyku: şimdi = süre yok; aralık = süre dakika; geçersiz aralık reddedilir', () => {
    expect(toInput(form({ category: 'sleep', type: 'sleep' }), TZ, NOW)).toMatchObject({
      type: 'sleep',
      durationMin: null,
    });
    const ok = toInput(
      form({
        category: 'sleep',
        type: 'sleep',
        mode: 'custom',
        ts: '2026-09-26T23:30',
        sleepEnd: '2026-09-27T07:00',
      }),
      TZ,
      NOW,
    );
    expect(ok).toMatchObject({ ts: '2026-09-26T20:30:00.000Z', durationMin: 450 });
    expect(
      toInput(
        form({
          category: 'sleep',
          type: 'sleep',
          mode: 'custom',
          ts: '2026-09-27T07:00',
          sleepEnd: '2026-09-27T06:00',
        }),
        TZ,
        NOW,
      ),
    ).toBe('sleepRange');
  });

  it('düzenlemede mevcut uyku bitişi hesaplanır', () => {
    const f = initialForm(
      {
        id: 'n',
        patientId: 'p',
        authorId: 'a',
        ts: '2026-09-26T20:30:00.000Z',
        type: 'sleep',
        carbsG: null,
        insulinU: null,
        durationMin: 450,
        waterMl: null,
        text: null,
        createdAt: '',
      },
      TZ,
      'meal',
      NOW,
    );
    expect(f).toMatchObject({
      category: 'sleep',
      mode: 'custom',
      ts: '2026-09-26T23:30',
      sleepEnd: '2026-09-27T07:00',
    });
  });

  it('kategori ve ayrıntılar', () => {
    expect(
      ['insulin_basal', 'water', 'sleep', 'exercise'].map((x) => categoryOf(x as never)),
    ).toEqual(['insulin', 'water', 'sleep', 'other']);
    expect(
      noteDetails(
        { type: 'water', carbsG: null, insulinU: null, durationMin: null, waterMl: 330 },
        t,
      ),
    ).toEqual(['330 ml']);
    expect(
      noteDetails(
        { type: 'sleep', carbsG: null, insulinU: null, durationMin: null, waterMl: null },
        t,
      ),
    ).toEqual(['entry.sleepOngoing']);
    expect(
      noteDetails(
        { type: 'sleep', carbsG: null, insulinU: null, durationMin: 450, waterMl: null },
        t,
      ),
    ).toEqual(['units.hoursMinutes:{"h":7,"m":30}']);
  });
});
