import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';
import type { EvidenceLevel, EvidenceSourceKind, MatchStrength } from '@evidex/shared';

/*
 * Paylaşılan arayüz parçaları (docs/redesign/02-design-system.md §Component contracts).
 * Yalnız gerçekten tekrar eden şeyler; sayfa özel yerleşim burada değil.
 */

type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger';
const BTN: Record<Variant, string> = {
  primary: 'bg-accent text-surface hover:bg-accent-strong',
  secondary: 'border border-line bg-surface text-ink hover:bg-paper-2',
  tertiary: 'text-accent hover:bg-accent-soft',
  danger: 'border border-line text-negative hover:bg-negative-soft',
};

/** Tek karar bağlamında tek primary; bekleme genişliği sabit tutar, çift isteği engeller. */
export function Button({
  variant = 'secondary',
  pending,
  pendingText,
  size = 'md',
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  pending?: boolean;
  pendingText?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      {...rest}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold whitespace-nowrap disabled:opacity-50 ${
        size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm'
      } ${BTN[variant]} ${className}`}
    >
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

export function LinkButton({
  variant = 'secondary',
  className = '',
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }) {
  return (
    <a
      {...rest}
      className={`pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-semibold whitespace-nowrap ${BTN[variant]} ${className}`}
    />
  );
}

/** Görünür kalıcı etiket + isteğe bağlı ipucu + hata (kontrolün altında, kurtarma yoluyla). */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-ink text-sm font-semibold">{label}</span>
      {hint && <span className="text-ink-soft mt-0.5 block text-sm">{hint}</span>}
      <div className="mt-1.5">{children}</div>
      {error && (
        <span role="alert" className="text-negative mt-1.5 block text-sm">
          {error}
        </span>
      )}
    </label>
  );
}

const CONTROL =
  'border-line bg-surface text-ink placeholder:text-ink-soft/70 focus:border-accent w-full rounded-[var(--radius-control)] border px-3.5 py-2.5 text-base outline-none';
export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={`${CONTROL} ${p.className ?? ''}`} />;
}
export function Textarea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={`${CONTROL} ${p.className ?? ''}`} />;
}

/** Kanıt seviyesi: her zaman etiketli; kısa açıklama title'da. */
export const LEVEL: Record<EvidenceLevel, { label: string; note: string; cls: string }> = {
  verified: {
    label: 'Doğrulanmış',
    note: 'Sahipliği makineyle doğrulanmış kaynak',
    cls: 'bg-verified-soft text-verified',
  },
  documented: {
    label: 'Belgeli',
    note: 'Belgeyle destekli',
    cls: 'bg-documented-soft text-documented',
  },
  referenced: {
    label: 'Referanslı',
    note: 'Platformda izlenen iş birliğinden kurum değerlendirmesi',
    cls: 'bg-referenced-soft text-referenced',
  },
  declared: {
    label: 'Beyan',
    note: 'Kişinin beyanı, henüz kanıtsız',
    cls: 'bg-declared-soft text-declared',
  },
};
export function LevelBadge({ level }: { level: EvidenceLevel }) {
  const l = LEVEL[level];
  return (
    <span
      title={l.note}
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${l.cls}`}
    >
      {l.label}
    </span>
  );
}

/** Eşleşme gücü: nitel, etiketli; sayı yok (KARAR-08). */
export const STRENGTH: Record<MatchStrength, { label: string; cls: string }> = {
  strong: { label: 'Güçlü', cls: 'bg-verified-soft text-verified' },
  possible: { label: 'Olası', cls: 'bg-accent-soft text-accent-strong' },
  weak: { label: 'Zayıf', cls: 'bg-declared-soft text-declared' },
};
export function StrengthBadge({ strength, long }: { strength: MatchStrength; long?: boolean }) {
  const s = STRENGTH[strength];
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${s.cls}`}>
      {s.label}
      {long ? ' eşleşme' : ''}
    </span>
  );
}

export const KIND: Record<EvidenceSourceKind, string> = {
  github_repo: 'GitHub',
  live_url: 'Canlı ürün',
  document: 'Belge',
  network_reference: 'Kurum referansı',
  challenge_submission: 'Meydan okuma',
};
/** Kaynak çipi: tür etiketi + okunur kısa kimlik; tam referans title'da. */
export function SourceChip({ kind, ref: r }: { kind: EvidenceSourceKind; ref: string }) {
  const kisa =
    kind === 'document'
      ? (r.split('#')[0] ?? r)
      : kind === 'network_reference'
        ? 'iş birliği kaydı'
        : r.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return (
    <span
      title={`${KIND[kind]} · ${r}`}
      className="bg-paper-2 text-ink-soft inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-xs"
    >
      <span className="text-ink font-semibold">{KIND[kind]}</span>
      <span className="truncate font-mono">{kisa}</span>
    </span>
  );
}

/** İskelet: son yerleşimi taklit eder, sonsuz parıltı yok (statik yer tutucu). */
export function Skeleton({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-label="Yükleniyor">
      <div className="bg-paper-2 h-8 w-56 rounded-md" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-paper-2 h-4 rounded" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

/** Boş durum: ne görüneceğini ve ilgili sonraki eylemi söyler. */
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-line rounded-[var(--radius-panel)] border border-dashed p-6">
      <p className="text-ink font-semibold">{title}</p>
      {children && <p className="text-ink-soft mt-1 max-w-prose text-sm">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Hata: başarısız kontrolün yanında, kurtarma yoluyla; sallanma animasyonu yok. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="bg-negative-soft text-negative mt-3 rounded-[var(--radius-control)] px-3 py-2 text-sm"
    >
      {children}
    </p>
  );
}

/** Beyaz çalışma yüzeyi: gölge yok, 1 px çizgi. */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border-line rounded-[var(--radius-panel)] border ${className}`}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-ink-soft text-xs font-bold tracking-wide uppercase">{children}</div>;
}

/**
 * Ajan metni (görev tanımı gibi) hafif Markdown taşır: **kalın**, `kod`, "- " ve "1. " satırları.
 * Tam Markdown motoru yok; bilinmeyen işaret olduğu gibi kalır. HTML'e dönüştürmez (XSS yok).
 */
export function Metin({ text, className = '' }: { text: string; className?: string }) {
  const satir = (s: string, key: number) => {
    const parcalar = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
    return (
      <span key={key}>
        {parcalar.map((p, i) =>
          p.startsWith('**') ? (
            <strong key={i} className="text-ink font-bold">
              {p.slice(2, -2)}
            </strong>
          ) : p.startsWith('`') ? (
            <code key={i} className="bg-paper-2 rounded px-1 py-0.5 font-mono text-[0.9em]">
              {p.slice(1, -1)}
            </code>
          ) : (
            p
          ),
        )}
      </span>
    );
  };
  const bloklar = text.replace(/\r/g, '').split(/\n{2,}/);
  return (
    <div className={`space-y-3 ${className}`}>
      {bloklar.map((b, bi) => {
        const satirlar = b.split('\n').filter((l) => l.trim() !== '');
        const liste = satirlar.length > 0 && satirlar.every((l) => /^\s*(-|\*|\d+[.)])\s+/.test(l));
        if (liste) {
          const sirali = /^\s*\d/.test(satirlar[0] ?? '');
          const Tag = sirali ? 'ol' : 'ul';
          return (
            <Tag key={bi} className={`space-y-1 pl-5 ${sirali ? 'list-decimal' : 'list-disc'}`}>
              {satirlar.map((l, li) => (
                <li key={li}>{satir(l.replace(/^\s*(-|\*|\d+[.)])\s+/, ''), li)}</li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={bi}>
            {satirlar.map((l, li) => (
              <span key={li}>
                {li > 0 && <br />}
                {satir(l, li)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export interface SkillRow {
  name: string;
  repos: number;
  commits: number;
  firstAt: string | null;
  lastAt: string | null;
  level: EvidenceLevel;
}
const ayKisa = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' }) : null;

/**
 * Yetkinlik seti: kanıttan ölçülmüş dil/araç satırları. Ajan yazmaz; her satır "kaç repo, kaç
 * commit, hangi dönem" ile gelir. Sıfır satırda hiç çizilmez (boş başlık yok).
 */
export function Skills({ skills, compact = false }: { skills: SkillRow[]; compact?: boolean }) {
  if (skills.length === 0) return null;
  return (
    <ul className={`grid gap-x-6 gap-y-1.5 ${compact ? '' : 'sm:grid-cols-2'}`}>
      {skills.map((s) => (
        <li key={s.name} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-ink font-semibold">{s.name}</span>
          <span className="text-ink-soft tnum shrink-0 text-xs">
            {s.repos} repo · {s.commits} commit
            {s.firstAt && ` · ${ayKisa(s.firstAt)} → ${ayKisa(s.lastAt) ?? 'devam'}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
