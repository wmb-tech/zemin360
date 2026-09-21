import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export interface OperatorNeed {
  id: string;
  title: string | null;
  cardStatus: 'draft' | 'approved';
  organizationName: string;
  shortlistPublishedAt: string | null;
  matches: { strong: number; possible: number; weak: number; introduced: number };
}

/** Operatör ekranlarında ortak ihtiyaç seçici: yalnız onaylı kartlar, kurum adıyla. */
export function NeedPicker({
  value,
  onChange,
  placeholder = 'İhtiyaç seç',
}: {
  value: string;
  onChange: (id: string, need: OperatorNeed | null) => void;
  placeholder?: string;
}) {
  const [needs, setNeeds] = useState<OperatorNeed[]>([]);
  useEffect(() => {
    void api<OperatorNeed[]>('/api/operator/needs').then((n) =>
      setNeeds(n.filter((x) => x.cardStatus === 'approved')),
    );
  }, []);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value, needs.find((n) => n.id === e.target.value) ?? null)}
      className="border-line bg-surface focus:border-accent w-full rounded-[var(--radius-control)] border px-3.5 py-2.5 text-base outline-none"
    >
      <option value="">{placeholder}</option>
      {needs.map((n) => (
        <option key={n.id} value={n.id}>
          {n.title ?? 'Başlıksız'} · {n.organizationName} · {n.matches.strong} güçlü
        </option>
      ))}
    </select>
  );
}
