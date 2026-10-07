import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SecimSecenek {
  value: string;
  label: string;
  /** İkinci satır: bağlam (ör. kurum adı, aday sayısı). */
  meta?: ReactNode;
}

/**
 * Markaya uyan açılır seçim (tarayıcının yerel listesi yerine). Klavye: ↓/↑ gezin, Enter seç,
 * Esc kapat; dışarı tıklayınca kapanır. Ekran okuyucu için listbox/option rolleri ve etkin
 * seçenek bildirimi. Seçenek yoksa düğme pasif ve boş metni söyler.
 */
export function Secim({
  value,
  onChange,
  options,
  placeholder = 'Seç',
  bos = 'Seçenek yok',
  ariaLabel,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  options: SecimSecenek[];
  placeholder?: string;
  bos?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [acik, setAcik] = useState(false);
  const [aktif, setAktif] = useState(0);
  const kok = useRef<HTMLDivElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  const id = useId();
  const secili = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (!acik) return;
    const disari = (e: MouseEvent) => {
      if (!kok.current?.contains(e.target as Node)) setAcik(false);
    };
    document.addEventListener('mousedown', disari);
    return () => document.removeEventListener('mousedown', disari);
  }, [acik]);
  useEffect(() => {
    if (acik)
      liste.current
        ?.querySelector<HTMLElement>(`[data-i="${aktif}"]`)
        ?.scrollIntoView({ block: 'nearest' });
  }, [acik, aktif]);

  const ac = () => {
    if (options.length === 0) return;
    setAktif(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setAcik(true);
  };
  const sec = (i: number) => {
    const o = options[i];
    if (o) onChange(o.value);
    setAcik(false);
  };
  const tus = (e: React.KeyboardEvent) => {
    if (!acik) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        ac();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAktif((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAktif((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      sec(aktif);
    } else if (e.key === 'Escape' || e.key === 'Tab') setAcik(false);
  };

  return (
    <div ref={kok} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={acik}
        aria-controls={`${id}-liste`}
        aria-activedescendant={acik ? `${id}-${aktif}` : undefined}
        aria-label={ariaLabel}
        disabled={options.length === 0}
        onClick={() => (acik ? setAcik(false) : ac())}
        onKeyDown={tus}
        className={`border-line bg-surface hover:border-ink-soft/40 focus-visible:border-accent flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-control)] border px-3.5 py-2 text-left outline-none disabled:opacity-60 ${acik ? 'border-accent' : ''}`}
      >
        <span className="min-w-0 flex-1">
          {secili ? (
            <>
              <span className="text-ink block truncate text-[15px] font-semibold">
                {secili.label}
              </span>
              {secili.meta && (
                <span className="text-ink-soft block truncate text-xs">{secili.meta}</span>
              )}
            </>
          ) : (
            <span className="text-ink-soft text-[15px]">
              {options.length === 0 ? bos : placeholder}
            </span>
          )}
        </span>
        <ChevronDown
          size={18}
          aria-hidden
          className={`text-ink-soft shrink-0 transition-transform duration-150 ${acik ? 'rotate-180' : ''}`}
        />
      </button>
      {acik && (
        <ul
          ref={liste}
          id={`${id}-liste`}
          role="listbox"
          className="bg-surface border-line absolute top-full right-0 left-0 z-30 mt-1.5 max-h-72 overflow-y-auto rounded-[var(--radius-panel)] border p-1.5 shadow-[0_1px_2px_rgba(32,37,61,0.06),0_16px_40px_rgba(32,37,61,0.14)]"
        >
          {options.map((o, i) => {
            const on = o.value === value;
            return (
              <li
                key={o.value}
                id={`${id}-${i}`}
                data-i={i}
                role="option"
                aria-selected={on}
                onMouseEnter={() => setAktif(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => sec(i)}
                className={`flex cursor-pointer items-start gap-2 rounded-[var(--radius-control)] px-3 py-2.5 ${i === aktif ? 'bg-paper-2' : ''}`}
              >
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm ${on ? 'text-accent-strong font-bold' : 'text-ink font-semibold'}`}
                  >
                    {o.label}
                  </span>
                  {o.meta && <span className="text-ink-soft mt-0.5 block text-xs">{o.meta}</span>}
                </span>
                {on && <Check size={16} aria-hidden className="text-accent mt-0.5 shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
