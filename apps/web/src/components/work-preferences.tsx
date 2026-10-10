import { useEffect, useState } from 'react';
import { TalentPreferences } from '@evidex/shared';
import { api } from '../lib/api';
import { Button, ErrorNote, Field, Input, Panel, Skeleton } from './ui';

const TYPES = {
  internship: 'Staj',
  project: 'Proje',
  part_time: 'Yarı zamanlı',
  full_time: 'Tam zamanlı',
  pilot_customer: 'Pilot müşteri',
  co_founder: 'Kurucu ortak',
  mentor: 'Mentorluk',
} as const;
const MODES = { remote: 'Uzaktan', hybrid: 'Hibrit', onsite: 'Yerinde' } as const;

export function WorkPreferences() {
  const [preferences, setPreferences] = useState<TalentPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    void api<TalentPreferences>('/api/me/preferences')
      .then(setPreferences)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Tercihler yüklenemedi'),
      );
  }, []);
  async function save() {
    if (!preferences || busy) return;
    const parsed = TalentPreferences.safeParse(preferences);
    if (!parsed.success) {
      setError('Haftalık saat 1–80, süre sınırı 1–260 hafta arasında olmalı.');
      return;
    }
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      setPreferences(
        await api<TalentPreferences>('/api/me/preferences', {
          method: 'PUT',
          body: JSON.stringify(preferences),
        }),
      );
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tercihler kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }
  function update(patch: Partial<TalentPreferences>) {
    setPreferences((current) => (current ? { ...current, ...patch } : current));
    setSaved(false);
  }
  if (!preferences) return error ? <ErrorNote>{error}</ErrorNote> : <Skeleton rows={3} />;
  return (
    <section className="mt-8">
      <h2 className="text-ink text-xl font-bold">Çalışma tercihlerin</h2>
      <p className="text-ink-soft mt-1 text-sm">
        Yeni eşleştirmeler bu tercihlere göre yapılır. Değişiklikler mevcut tanıştırmaları iptal
        etmez.
      </p>
      <Panel className="mt-4 p-5 md:p-6">
        <fieldset disabled={busy} className="space-y-5">
          <Field label="Yeni iş birliklerine açık mısın?">
            <select
              className="border-line bg-surface text-ink min-h-11 w-full rounded-[var(--radius-control)] border px-3"
              value={preferences.availability}
              onChange={(e) =>
                update({ availability: e.target.value as TalentPreferences['availability'] })
              }
            >
              <option value="open">Yeni iş birliklerine açığım</option>
              <option value="limited">Sınırlı zaman ayırabilirim</option>
              <option value="unavailable">Şu an müsait değilim</option>
            </select>
          </Field>
          <fieldset>
            <legend className="text-ink text-sm font-semibold">İş birliği türleri</legend>
            <p className="text-ink-soft mb-2 text-xs">
              Seçim yapmazsan tüm türler değerlendirilir.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {Object.entries(TYPES).map(([key, label]) => {
                const value = key as TalentPreferences['collaborationTypes'][number];
                return (
                  <label
                    key={key}
                    className="text-ink inline-flex min-h-11 items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={preferences.collaborationTypes.includes(value)}
                      onChange={(e) =>
                        update({
                          collaborationTypes: e.target.checked
                            ? [...preferences.collaborationTypes, value]
                            : preferences.collaborationTypes.filter((item) => item !== value),
                        })
                      }
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-ink text-sm font-semibold">Çalışma biçimi</legend>
            <p className="text-ink-soft mb-2 text-xs">
              Seçim yapmazsan tüm biçimler değerlendirilir.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {Object.entries(MODES).map(([key, label]) => {
                const value = key as TalentPreferences['workModes'][number];
                return (
                  <label
                    key={key}
                    className="text-ink inline-flex min-h-11 items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={preferences.workModes.includes(value)}
                      onChange={(e) =>
                        update({
                          workModes: e.target.checked
                            ? [...preferences.workModes, value]
                            : preferences.workModes.filter((item) => item !== value),
                        })
                      }
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Haftalık ayırabileceğin saat"
              hint="İsteğe bağlı; görüşmede netleştirilir."
            >
              <Input
                type="number"
                min={1}
                max={80}
                value={preferences.weeklyHours ?? ''}
                onChange={(e) =>
                  update({ weeklyHours: e.target.value ? Number(e.target.value) : null })
                }
                placeholder="Örn. 20"
              />
            </Field>
            <Field label="En uzun iş birliği süresi" hint="Hafta; boş bırakırsan süre sınırı yok.">
              <Input
                type="number"
                min={1}
                max={260}
                value={preferences.maxDurationWeeks ?? ''}
                onChange={(e) =>
                  update({ maxDurationWeeks: e.target.value ? Number(e.target.value) : null })
                }
                placeholder="Örn. 12"
              />
            </Field>
          </div>
          <Button
            variant="primary"
            pending={busy}
            pendingText="Kaydediliyor…"
            onClick={() => void save()}
          >
            Tercihleri kaydet
          </Button>
        </fieldset>
        {saved && (
          <p role="status" className="text-verified mt-3 text-sm">
            Tercihlerin kaydedildi.
          </p>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
      </Panel>
    </section>
  );
}
