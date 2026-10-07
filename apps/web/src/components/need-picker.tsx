import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Secim } from './secim';

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
    <Secim
      value={value}
      onChange={(id) => onChange(id, needs.find((n) => n.id === id) ?? null)}
      placeholder={placeholder}
      bos="Onaylı ihtiyaç yok"
      ariaLabel="İhtiyaç"
      options={needs.map((n) => ({
        value: n.id,
        label: n.title ?? 'Başlıksız',
        meta: `${n.organizationName} · ${n.matches.strong} güçlü · ${n.matches.possible} olası aday`,
      }))}
    />
  );
}
